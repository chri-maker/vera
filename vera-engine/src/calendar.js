// ============================================================
//  VERA CALENDAR — collegamento all'agenda (Google Calendar)
//  getFreeSlots(): legge gli impegni e calcola gli slot liberi
//  createEvent():  scrive l'appuntamento in agenda
//  OAuth via env: GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REFRESH_TOKEN
// ============================================================
import { google } from "googleapis";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function authClient() {
  const o = new google.auth.OAuth2(
    process.env.GCAL_CLIENT_ID,
    process.env.GCAL_CLIENT_SECRET
  );
  o.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
  return o;
}

/**
 * Calcola gli slot liberi nei prossimi N giorni incrociando
 * gli orari di apertura dello studio con gli impegni in agenda.
 */
export async function getFreeSlots(studio, { days = 10 } = {}) {
  const cal = google.calendar({ version: "v3", auth: authClient() });
  const now = new Date();
  const end = new Date(now.getTime() + days * 864e5);

  // impegni occupati dall'agenda
  const fb = await cal.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      timeZone: studio.timezone,
      items: [{ id: studio.calendar.calendarId || "primary" }],
    },
  });
  const busy = (fb.data.calendars[studio.calendar.calendarId || "primary"].busy || [])
    .map((b) => [new Date(b.start), new Date(b.end)]);

  const step = (studio.slotGranularityMin || 30) * 60000;
  const slots = [];
  for (let d = 0; d < days && slots.length < 40; d++) {
    const day = new Date(now.getTime() + d * 864e5);
    const key = DAYS[day.getDay()];
    for (const range of studio.hours[key] || []) {
      const [h1, h2] = range.split("-");
      let t = atTime(day, h1);
      const close = atTime(day, h2);
      for (; t + step <= close; t += step) {
        if (t < now.getTime()) continue; // niente slot nel passato
        const s = new Date(t), e = new Date(t + step);
        const overlaps = busy.some(([bs, be]) => s < be && e > bs);
        if (!overlaps) slots.push({ startISO: s.toISOString(), label: labelIt(s) });
      }
    }
  }
  return slots;
}

/** Scrive l'appuntamento in agenda. */
export async function createEvent(studio, { service, startISO, patientName, patientContact }) {
  const cal = google.calendar({ version: "v3", auth: authClient() });
  const dur = (studio.services.find((s) => s.name === service)?.duration || 45) * 60000;
  const start = new Date(startISO);
  const ev = await cal.events.insert({
    calendarId: studio.calendar.calendarId || "primary",
    requestBody: {
      summary: `${service} — ${patientName}`,
      description: `Prenotato da Vera 🤖\nPaziente: ${patientName}\nContatto: ${patientContact}`,
      start: { dateTime: start.toISOString(), timeZone: studio.timezone },
      end: { dateTime: new Date(start.getTime() + dur).toISOString(), timeZone: studio.timezone },
    },
  });
  return { id: ev.data.id, startISO, service, patientName };
}

function atTime(day, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
function labelIt(d) {
  return d.toLocaleString("it-IT", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}
