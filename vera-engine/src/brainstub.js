// ============================================================
//  BRAIN STUB — cervello "finto" per la MODALITÀ DEMO
//  (quando non c'è ANTHROPIC_API_KEY). Fa girare il widget a
//  costo zero. NON è intelligente: segue regole semplici.
//  In produzione il cervello è src/brain.js (Claude).
// ============================================================

const YES = /\b(s[iì]|ok|okay|va bene|va benissimo|benissimo|perfetto|ottimo|certo|prendo|prendiamo|confermo|d'accordo|volentieri|quello|quella|ci sto|mi va|andata|fissalo|fissiamo|prenota)\b/i;
const FIRST = /\b(?:il\s|la\s)?prim[oa]\b/i;
const SECOND = /\b(?:il\s|la\s)?second[oa]\b/i;
const OTHER = /\baltr[oiae]\b|non (?:riesco|posso|va bene|mi va)|impegnat|occupat|più avanti|piu avanti|un'?altra|un altro giorno/i;
const PAIN = /mal\s?di|dolor|fa male|male (?:a|al|alla)|contrattur|cervical|schien|infortun|fastidi|blocc|strapp|stort/i;
const INTENT = /appuntament|prenot|visit|fissar|fissiamo|venire|passare|orari|disponib|liber[oi]|posto|slot/i;
const NAME = /(?:sono|mi chiamo|il mio nome è|a nome(?: di)?)\s+([a-zà-ÿ']{2,})(?:\s+([a-zà-ÿ']{2,}))?/i;
const TIME = /\b(\d{1,2})[:.](\d{2})\b|\balle (?:ore )?(\d{1,2})\b/i;
// parole che NON possono essere un nome/cognome
const STOP = new Set(("e ho hai ha mi ti ci che per un una il lo la le li di da in con su al alla dal della " +
  "vorrei volevo avrei posso puoi puo sono sto stavo qui qua ancora oggi domani pure fissalo fissa fissare " +
  "prenota prenotalo confermo conferma quello quella preferisco scelgo prendo primo secondo prima seconda " +
  "grazie allora signor signora dott dottore va bene benissimo ottimo perfetto ok certo").split(" "));

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const DAYS = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"];
const cap = (s) => s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const daysIn = (text) => DAYS.filter((d) => norm(text).includes(d));
const slotForDay = (slots, day) => slots.find((s) => norm(s.label).includes(day)) || null;

// nome detto esplicitamente ("sono Marco Rossi"), nel messaggio o nella storia
function findName(message, history) {
  const texts = [message, ...(history || []).filter((h) => h.role === "user").map((h) => h.content).reverse()];
  for (const t of texts) {
    const m = (t || "").match(NAME);
    if (m) {
      let name = m[1];
      if (m[2] && !STOP.has(norm(m[2]))) name += " " + m[2];
      return cap(name);
    }
  }
  return null;
}

// gli slot citati nell'ULTIMO messaggio di Vera (per capire cosa sta confermando il paziente)
function lastProposal(history, slots) {
  const h = history || [];
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].role !== "assistant") continue;
    const found = slots.filter((s) => (h[i].content || "").includes(s.label));
    if (found.length) return found;
  }
  return [];
}

// risposta FAQ dalla config studio (match per parole chiave)
function faqAnswer(studio, message) {
  const t = norm(message);
  for (const f of studio?.faq || []) {
    if (/\bdove\b/.test(t) && /indirizz|dove/.test(norm(f.q))) return f.a;
    const keys = norm(f.q).split(/[^a-z']+/).filter((w) => w.length >= 5);
    if (keys.some((k) => t.includes(k))) return f.a;
  }
  return null;
}

export async function decide({ studio, history, message, availability }) {
  const slots = availability || [];
  const said = (history || []).filter((h) => h.role === "assistant").map((h) => h.content).join(" | ");
  const proposed = /ho libero|le propongo|ho anche|ho posto|glielo fisso/i.test(said);
  const lastA = [...(history || [])].reverse().find((h) => h.role === "assistant");
  const askedName = /nome/i.test((lastA && lastA.content) || "");
  const faq = faqAnswer(studio, message);
  const service = (studio?.services?.[0]?.name) || "Prima visita";
  const reply = (r) => ({ reply: r, action: "reply", booking: null });

  const book = (slot, name) => {
    if (!name) return reply(`Perfetto — ${slot.label}! Mi lascia solo nome e cognome, così le intesto l'appuntamento?`);
    return {
      reply: `Perfetto ${name}, le ho fissato: ${service.toLowerCase()} — ${slot.label}. Riceverà un promemoria il giorno prima. A presto! 🙂${faq ? "\n\n" + faq : ""}`,
      action: "book",
      booking: { service, startISO: slot.startISO, patientName: name },
    };
  };

  if (!slots.length)
    return reply("Buongiorno! In questo momento non ho orari liberi a breve, ma la faccio richiamare dallo studio. Mi lascia un recapito?");

  // ---- prima interazione: accogli e proponi ----
  if (!proposed) {
    if (faq && !INTENT.test(message))
      return reply(faq + " Se vuole, le posso già proporre un paio di orari per una visita 🙂");
    const opening = faq
      ? faq + " Se intanto vuole prenotare: "
      : PAIN.test(message)
        ? `Mi dispiace per il fastidio! Per questi casi la cosa giusta è una ${service.toLowerCase()}, così il professionista valuta bene la situazione. `
        : "Buongiorno! ";
    const opt = slots.slice(0, 2).map((s) => s.label).join(" oppure ");
    return reply(`${opening}Ho libero ${opt}. Quale preferisce? E a che nome fisso l'appuntamento?`);
  }

  const name = findName(message, history);
  const wantedDays = daysIn(message);
  const proposal = lastProposal(history, slots);
  const confirming = YES.test(message) || FIRST.test(message) || SECOND.test(message) || TIME.test(message);

  // ---- domanda FAQ nel mezzo del flusso ("ok e dove siete?") → rispondi, non prenotare ----
  if (faq && !FIRST.test(message) && !SECOND.test(message) && !TIME.test(message) && !wantedDays.length && !NAME.test(message) && /dove|quant|cost|portar|\?/i.test(message))
    return reply(faq + " Per l'appuntamento, quale orario le torna meglio tra quelli proposti?");

  // ---- "altri giorni?" / "lunedì non riesco" → proponi il resto ----
  if (OTHER.test(message) && !confirming) {
    const shown = new Set(proposal.map((s) => s.label));
    const rest = slots.filter((s) => !shown.has(s.label) && !wantedDays.some((d) => norm(s.label).includes(d)));
    if (rest.length)
      return reply(`Certo! Ho anche ${rest.slice(0, 2).map((s) => s.label).join(" oppure ")}. Le va bene?${name ? "" : " E a che nome fisso l'appuntamento?"}`);
    return reply("A brevissimo purtroppo ho solo quegli orari 😕 Se mi lascia un recapito, la faccio richiamare appena si libera qualcosa.");
  }

  // ---- chiede un giorno preciso: "martedì avete posto?" ----
  if (wantedDays.length && !confirming) {
    const hit = wantedDays.map((d) => slotForDay(slots, d)).find(Boolean);
    if (hit) return reply(`Sì! ${hit.label} ho posto — glielo fisso?${name ? "" : " Mi lasci anche nome e cognome 🙂"}`);
    const opt = slots.slice(0, 2).map((s) => s.label).join(" oppure ");
    return reply(`Lì purtroppo non ho disponibilità 😕 Però ho libero ${opt}. Può andare una di queste?`);
  }

  // ---- risposta col solo nome, dopo che gliel'abbiamo chiesto ----
  let bareName = null;
  if (askedName && !confirming) {
    const words = message.trim().replace(/[,.!?;:]+/g, " ").trim().split(/\s+/);
    if (words.length <= 3 && words.every((w) => /^[a-zà-ÿ']{2,}$/i.test(w) && !STOP.has(norm(w))))
      bareName = cap(words.join(" "));
  }

  // ---- conferma → prenota lo slot GIUSTO ----
  if (confirming || bareName || (askedName && name)) {
    let slot = null;
    if (FIRST.test(message)) slot = proposal[0] || slots[0];
    else if (SECOND.test(message)) slot = proposal[1] || slots[1] || slots[0];
    if (!slot && wantedDays.length) slot = wantedDays.map((d) => slotForDay(slots, d)).find(Boolean);
    if (!slot) {
      const tm = message.match(TIME);
      if (tm) {
        const hh = String(tm[1] || tm[3]).padStart(2, "0");
        const mm = tm[2] || "00";
        slot = slots.find((s) => s.label.includes(`${hh}:${mm}`)) || null;
      }
    }
    if (!slot) slot = proposal[0] || slots[0];
    return book(slot, name || bareName);
  }

  if (faq) return reply(faq + " Per l'appuntamento, quale orario le torna meglio tra quelli proposti?");

  return reply("Mi dica pure quale orario preferisce tra quelli proposti — o il giorno che le è più comodo — e ci penso io 🙂");
}
