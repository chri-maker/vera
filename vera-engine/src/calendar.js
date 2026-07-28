// ============================================================
//  VERA CALENDAR — agenda vera (Google Calendar, via n8n)
//  Il motore NON parla direttamente con Google: manda tutto al
//  webhook n8n "Vera — Google Calendar", dove vive l'account.
//  - getFreeSlots(): orari di apertura MENO impegni reali
//  - createEvent():  scrive l'appuntamento in agenda
//  Config: env VERA_GCAL_WEBHOOK (se manca, il server resta in demo).
//  Se il webhook non risponde, la chat NON si blocca mai:
//  gli slot escono dai soli orari di apertura e la prenotazione
//  viene comunque notificata al titolare via email.
// ============================================================

const HOOK = process.env.VERA_GCAL_WEBHOOK || "";

async function callHook(payload) {
  const r = await fetch(HOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("webhook calendario HTTP " + r.status);
  return r.json();
}

// ---- orari nel fuso dello studio, senza librerie esterne ----
function offsetAt(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}
function zonedMs(y, m, d, hh, mm, tz) {
  let t = Date.UTC(y, m - 1, d, hh, mm);
  t = Date.UTC(y, m - 1, d, hh, mm) - offsetAt(t, tz);
  t = Date.UTC(y, m - 1, d, hh, mm) - offsetAt(t, tz); // secondo giro per i cambi d'ora
  return t;
}
function ymdIn(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, wd: p.weekday.toLowerCase().slice(0, 3) };
}
const labelIt = (d, tz) =>
  d.toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz });

/**
 * Slot liberi nei prossimi N giorni: orari di apertura dello studio
 * incrociati con gli impegni REALI letti da Google Calendar.
 */
export async function getFreeSlots(studio, { days = 10 } = {}) {
  const tz = studio.timezone || "Europe/Rome";
  const calId = (studio.calendar && studio.calendar.calendarId) || "primary";
  const now = Date.now();

  // impegni reali (se l'agenda è irraggiungibile: lista vuota, si va avanti)
  let busy = [];
  try {
    const r = await callHook({
      op: "freebusy",
      calendarId: calId,
      timeMin: new Date(now).toISOString(),
      timeMax: new Date(now + days * 864e5).toISOString(),
      timeZone: tz,
    });
    busy = ((r && r.busy) || [])
      .map((b) => [Date.parse(b.start), Date.parse(b.end)])
      .filter(([a, b2]) => !isNaN(a) && !isNaN(b2));
  } catch {
    busy = [];
  }

  const step = (studio.slotGranularityMin || 30) * 60000;
  const slots = [];
  for (let dd = 0; dd < days && slots.length < 8; dd++) {
    const { y, m, d, wd } = ymdIn(now + dd * 864e5, tz);
    for (const range of (studio.hours && studio.hours[wd]) || []) {
      const [h1, h2] = range.split("-");
      const [H1, M1] = h1.split(":").map(Number);
      const [H2, M2] = h2.split(":").map(Number);
      const open = zonedMs(y, m, d, H1, M1, tz);
      const close = zonedMs(y, m, d, H2, M2, tz);
      for (let t = open; t + step <= close && slots.length < 8; t += step) {
        if (t < now + 60 * 60000) continue; // niente passato, niente "tra 5 minuti"
        const overlaps = busy.some(([bs, be]) => t < be && t + step > bs);
        if (!overlaps) slots.push({ startISO: new Date(t).toISOString(), label: labelIt(new Date(t), tz) });
      }
    }
  }
  return slots;
}

/** Scrive l'appuntamento in Google Calendar (via n8n). */
export async function createEvent(studio, { service, startISO, patientName, patientContact }) {
  const tz = studio.timezone || "Europe/Rome";
  const calId = (studio.calendar && studio.calendar.calendarId) || "primary";
  const dur = ((studio.services || []).find((s) => s.name === service)?.duration || 45) * 60000;
  const start = new Date(startISO);
  try {
    const r = await callHook({
      op: "create",
      calendarId: calId,
      timeZone: tz,
      startISO: start.toISOString(),
      endISO: new Date(start.getTime() + dur).toISOString(),
      summary: `${service || "Appuntamento"} — ${patientName || "Paziente"}`,
      description: `Prenotato da Vera 🤖\nPaziente: ${patientName || "-"}\nContatto: ${patientContact || "-"}`,
    });
    return {
      id: (r && r.id) || "evt_" + Date.now(),
      htmlLink: (r && r.htmlLink) || "",
      service, startISO, patientName, patientContact,
    };
  } catch {
    // agenda irraggiungibile: la prenotazione va avanti lo stesso,
    // il titolare riceve comunque l'email e sistema a mano.
    return { id: "evt_manuale_" + Date.now(), calendarError: true, service, startISO, patientName, patientContact };
  }
}
