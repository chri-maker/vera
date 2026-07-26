// ============================================================
//  VERA ENGINE — orchestratore (indipendente dal canale)
//  Non importa nulla di esterno: riceve "brain" e "calendar"
//  come dipendenze, così è testabile senza account.
// ============================================================

/**
 * Gestisce un messaggio in arrivo e produce la risposta di Vera.
 * @param {object} ctx  - { studio, from, text, history }
 * @param {object} deps - { brain, calendar }
 * @returns {Promise<{reply:string, action:string, booking:object|null}>}
 */
export async function handleMessage(ctx, deps) {
  const { studio, from, text, history = [] } = ctx;
  const { brain, calendar } = deps;

  // 1) Leggo dall'agenda gli slot REALMENTE liberi (prossimi 10 giorni)
  const availability = await calendar.getFreeSlots(studio, { days: 10 });

  // 2) Il cervello AI capisce il messaggio e decide cosa fare
  const decision = await brain.decide({ studio, history, message: text, availability });

  // 3) Se ha deciso di prenotare, scrivo davvero l'appuntamento in agenda
  let booking = null;
  if (decision.action === "book" && decision.booking && decision.booking.startISO) {
    booking = await calendar.createEvent(studio, {
      service: decision.booking.service,
      startISO: decision.booking.startISO,
      patientName: decision.booking.patientName || "Paziente",
      patientContact: from,
    });
  }

  return { reply: decision.reply, action: decision.action, booking };
}
