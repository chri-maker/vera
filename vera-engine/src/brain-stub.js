// ============================================================
//  BRAIN STUB — cervello "finto" leggero per la MODALITÀ DEMO
//  (quando non c'è la chiave AI). Serve a far girare il widget
//  senza account. In produzione si usa src/brain.js (Claude).
// ============================================================
const YES = /\b(s[iì]|ok|va bene|benissimo|perfetto|ottimo|certo|prendo|prendiamo|confermo|d'accordo|volentieri|quello|quella|il primo|la prima|il secondo|ci sto|mi va)\b/i;
const NAME = /(?:sono|mi chiamo|il mio nome è)\s+([A-Za-zÀ-ÿ']{2,})/i;

export async function decide({ history, message, availability }) {
  const slots = availability || [];
  const said = (history || []).map((h) => h.content).join(" ");
  const proposed = /ho libero|le propongo|va bene .*\d{1,2}[:.]/i.test(said);

  // Prima risposta: proponi 1-2 slot
  if (!proposed) {
    if (!slots.length)
      return { reply: "Buongiorno! In questo momento non ho orari liberi a breve, ma le faccio richiamare dallo studio. Mi lascia un recapito?", action: "reply", booking: null };
    const opt = slots.slice(0, 2).map((s) => s.label).join(" oppure ");
    return { reply: `Buongiorno! Ho libero ${opt}. Quale preferisce? E a che nome fisso l'appuntamento?`, action: "reply", booking: null };
  }

  // Conferma → prenoto
  if (YES.test(message) || /\d{1,2}[:.]?\d{0,2}/.test(message)) {
    const name = (message.match(NAME) || said.match(NAME) || [])[1] || "Paziente";
    const slot = slots[0];
    if (slot)
      return {
        reply: `Perfetto ${name}, le ho fissato l'appuntamento per ${slot.label}. Le arriverà un promemoria il giorno prima. A presto! 🙂`,
        action: "book",
        booking: { service: "Trattamento", startISO: slot.startISO, patientName: name },
      };
  }
  return { reply: "Mi dica pure giorno e ora che preferisce e il suo nome, così le fisso l'appuntamento.", action: "reply", booking: null };
}
