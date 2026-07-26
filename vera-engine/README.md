# 🧠 Vera Engine — il motore

La segretaria virtuale AI, vera. Un solo motore, **un file di configurazione per ogni studio**
(`studios/nome-studio.json`). Aggiungere un cliente = creare la sua config + collegare agenda + collegare WhatsApp.

## Com'è fatto (i pezzi)

```
Paziente → [WhatsApp / chat sito] → SERVER → ENGINE
                                               ├─ CALENDAR  (legge slot liberi + scrive appuntamento)
                                               └─ BRAIN (Claude)  (capisce e decide la risposta)
                                        → risposta al paziente
```

- `src/brain.js` — il cervello: Claude legge messaggio + config studio + slot liberi e decide risposta/prenotazione.
- `src/calendar.js` — collegamento Google Calendar: slot liberi reali + scrittura appuntamento.
- `src/engine.js` — mette tutto insieme (indipendente dal canale).
- `studios/*.json` — **un file per studio** (nome, servizi, orari, prezzi, tono, agenda, numero).
- `test/dryrun.js` — prova il motore **senza account** (finto). → `npm run dryrun`
- `test/chat.js` — parla con la **Vera vera** dal terminale (serve solo la chiave AI). → `npm run chat`

## Provalo subito (3 livelli)

**1) Il motore da solo** — verifica che giri (nessun account):
```bash
node test/dryrun.js
```

**2) IL WIDGET SUL SITO** ⭐ (nessun account, modalità demo):
```bash
node src/server.js
```
Apri **http://localhost:3000/demo** → in basso a destra c'è la bollina di Vera. Scrivile come un paziente: propone gli orari e "fissa" l'appuntamento. Questo è ciò che vede lo studio.

**3) Con l'AI vera** (Claude al posto del cervello demo):
```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
node src/server.js      # ora il widget usa Claude
```

### Come lo installa uno studio (l'"easy install")
Una riga nel sito del cliente:
```html
<script src="https://TUO-SERVER/widget.js" data-studio="studio-mario"></script>
```
Cambi solo `data-studio`. Servizi/orari/tono stanno nel file `studios/studio-mario.json`.

## Account da aprire (in ordine)

1. **Anthropic API** (il cervello) → console.anthropic.com → crea una API key. È l'unica cosa che serve per il punto 2 qui sopra.
2. **Google Cloud** (l'agenda) → progetto + Google Calendar API + OAuth → ricavi `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET`, `GCAL_REFRESH_TOKEN`.
3. **Hosting** (per farlo girare 24/7) → Railway o Render (piani economici, deploy in pochi click).
4. **WhatsApp** → dipende dalla strada che scegliamo (te la spiego in chat).

## Onboarding di un nuovo studio (l'"easy install")

1. Copia `studios/studio-demo.json` → `studios/studio-mario-rossi.json` e compila (servizi, orari, prezzi, tono).
2. Collega l'agenda dello studio (Google Calendar).
3. Collega il WhatsApp.
4. Fatto. Il motore è lo stesso per tutti.

## Variabili d'ambiente (.env)

```
ANTHROPIC_API_KEY=
VERA_MODEL=            # ID modello attuale da docs.claude.com/models
GCAL_CLIENT_ID=
GCAL_CLIENT_SECRET=
GCAL_REFRESH_TOKEN=
```

## Stato

- ✅ Cuore del motore (brain + agenda + orchestrazione + config multi-studio) — fatto e testato.
- ✅ Server + Widget chat per il sito (installazione con 1 riga) — fatto e testato in modalità demo.
- ⏳ Deploy online 24/7 (Railway/Render) — prossimo passo.
- ⏳ Collegamento vero a Google Calendar (chiavi OAuth) — dopo.
- ⏳ Promemoria automatici 24h prima — dopo.
- ⏳ Adattatore WhatsApp — più avanti (quando serve).
