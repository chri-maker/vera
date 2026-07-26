// ============================================================
//  DRY RUN — prova il motore SENZA account (brain e calendar finti)
//  Serve a verificare che l'orchestrazione funzioni.
//  Avvio:  node test/dryrun.js
// ============================================================
import { handleMessage } from "../src/engine.js";
import { readFileSync } from "node:fs";

const studio = JSON.parse(readFileSync(new URL("../studios/studio-demo.json", import.meta.url)));

// --- CALENDAR finto: 2 slot liberi fissi ---
const calendarStub = {
  async getFreeSlots() {
    return [
      { startISO: "2026-07-31T16:00:00+02:00", label: "venerdì 31 luglio, 16:00" },
      { startISO: "2026-07-31T17:00:00+02:00", label: "venerdì 31 luglio, 17:00" },
    ];
  },
  async createEvent(_studio, b) {
    return { id: "evt_fake_123", ...b };
  },
};

// --- BRAIN finto: simula la logica AI a step (senza chiamare Claude) ---
let step = 0;
const brainStub = {
  async decide({ message, availability }) {
    step++;
    if (step === 1)
      return {
        reply: `Buongiorno! Per il mal di schiena ho libero ${availability[0].label} o ${availability[1].label}. Quale preferisce? E il suo nome?`,
        action: "reply", booking: null,
      };
    return {
      reply: "Perfetto Marco, le ho fissato venerdì alle 16:00. Le arriverà un promemoria. Buona giornata!",
      action: "book",
      booking: { service: "Trattamento osteopatico", startISO: availability[0].startISO, patientName: "Marco" },
    };
  },
};

const deps = { brain: brainStub, calendar: calendarStub };

async function main() {
  const history = [];
  const conv = [
    "Buongiorno, ho un forte mal di schiena, avreste posto venerdì pomeriggio?",
    "Venerdì alle 16 va benissimo, sono Marco",
  ];
  for (const text of conv) {
    console.log("\n👤 Paziente:", text);
    const out = await handleMessage({ studio, from: "+39333...", text, history }, deps);
    console.log("🤖 Vera:", out.reply);
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: out.reply });
    if (out.booking) console.log("   ✅ APPUNTAMENTO IN AGENDA:", out.booking.service, "→", out.booking.startISO, "(id", out.booking.id + ")");
  }
  console.log("\n— Dry run OK: il motore riceve, capisce, propone e prenota. —");
}
main().catch((e) => { console.error(e); process.exit(1); });
