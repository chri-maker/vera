// ============================================================
//  VERA BRAIN — il cervello AI (Claude)
//  Legge il messaggio del paziente + la config dello studio +
//  gli slot liberi reali, e decide la risposta / la prenotazione.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // usa la variabile d'ambiente ANTHROPIC_API_KEY
// ID modello attuale (luglio 2026). Se un giorno cambia, imposta VERA_MODEL su Render
// con l'ID nuovo da https://platform.claude.com/docs/en/about-claude/models/overview
const MODEL = process.env.VERA_MODEL || "claude-sonnet-5";

function systemPrompt(studio, availability) {
  const servizi = studio.services.map((s) => `${s.name} (${s.duration} min)`).join(", ");
  const faq = (studio.faq || []).map((f) => `${f.q} → ${f.a}`).join(" | ");
  return `Sei "Vera", la segretaria virtuale dello studio "${studio.name}".
Lingua: ${studio.language}. Tono: ${studio.tone}.
Servizi offerti: ${servizi}.
Orari di apertura settimanali: ${JSON.stringify(studio.hours)}.
FAQ dello studio: ${faq || "nessuna"}.

SLOT LIBERI REALI (puoi proporre e prenotare SOLO questi, mai inventarne altri):
${JSON.stringify(availability)}

Come ti comporti:
- Scrivi come una persona vera al telefono/WhatsApp: breve, ${studio.tone}. Niente frasi da robot, niente "prema 1".
- Capisci la richiesta (tipo di problema, giorno/ora preferiti) e proponi 1-2 slot liberi coerenti tra quelli disponibili.
- Se il paziente conferma un orario, procedi con la prenotazione.
- Chiedi il nome del paziente se non lo conosci prima di confermare.
- Se ti chiedono qualcosa di clinico o fuori dalle tue competenze, usa "handoff": ${studio.handoff || "faccio richiamare lo studio"}.

Rispondi SEMPRE e SOLO con un JSON valido, senza testo attorno:
{"reply": "il messaggio da inviare al paziente",
 "action": "reply" | "book" | "handoff",
 "booking": {"service":"nome servizio","startISO":"2026-01-01T16:00:00+01:00","patientName":"Nome"} | null}`;
}

/**
 * Decide la prossima mossa di Vera.
 * @returns {Promise<{reply:string, action:string, booking:object|null}>}
 */
export async function decide({ studio, history, message, availability }) {
  // Pulizia storico: il widget include già il messaggio corrente nella history,
  // quindi evitiamo doppioni; uniamo turni consecutivi dello stesso ruolo e
  // garantiamo che la conversazione inizi con l'utente (requisiti dell'API).
  const messages = [];
  for (const h of history || []) {
    if (!h || !h.content) continue;
    const role = h.role === "assistant" ? "assistant" : "user";
    if (messages.length && messages[messages.length - 1].role === role)
      messages[messages.length - 1].content += "\n" + h.content;
    else messages.push({ role, content: h.content });
  }
  while (messages.length && messages[0].role === "assistant") messages.shift();
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") messages.push({ role: "user", content: message });
  else if (!last.content.endsWith(message)) last.content += "\n" + message;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: systemPrompt(studio, availability),
    messages,
  });
  const text = res.content.map((b) => b.text || "").join("");
  return safeParse(text);
}

function safeParse(t) {
  try {
    const m = t.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : t);
    if (!obj.action) obj.action = "reply";
    if (obj.booking === undefined) obj.booking = null;
    return obj;
  } catch (e) {
    return { reply: t || "Mi scusi, può ripetere?", action: "reply", booking: null };
  }
}
