// ============================================================
//  CHAT — parla con la VERA VERA (cervello Claude) dal terminale
//  Agenda finta (slot demo) così testi l'AI senza Google.
//  Serve solo: npm install  +  ANTHROPIC_API_KEY nel file .env
//  Avvio:  npm run chat
// ============================================================
import "dotenv/config";
import { handleMessage } from "../src/engine.js";
import * as brain from "../src/brain.js";
import { readFileSync } from "node:fs";
import readline from "node:readline";

const studio = JSON.parse(readFileSync(new URL("../studios/studio-demo.json", import.meta.url)));

// Agenda demo: qualche slot libero fisso (così non serve Google per provare)
const calendar = {
  async getFreeSlots() {
    return [
      { startISO: "2026-07-31T16:00:00+02:00", label: "giovedì 31 luglio, 16:00" },
      { startISO: "2026-07-31T17:30:00+02:00", label: "giovedì 31 luglio, 17:30" },
      { startISO: "2026-08-01T09:00:00+02:00", label: "venerdì 1 agosto, 09:00" },
    ];
  },
  async createEvent(_s, b) { return { id: "evt_demo_" + Date.now(), ...b }; },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));
const history = [];

console.log("\n🤖 Vera è online (agenda demo). Scrivi come un paziente. Ctrl+C per uscire.\n");
(async function loop() {
  while (true) {
    const text = await ask("👤 Tu: ");
    if (!text.trim()) continue;
    try {
      const out = await handleMessage({ studio, from: "+39333CLI", text, history }, { brain, calendar });
      console.log("🤖 Vera:", out.reply);
      if (out.booking) console.log("   ✅ Prenotato in agenda:", out.booking.service, out.booking.startISO);
      history.push({ role: "user", content: text }, { role: "assistant", content: out.reply });
    } catch (e) {
      console.log("⚠️  Errore:", e.message, "\n   (Hai fatto `npm install` e messo ANTHROPIC_API_KEY nel .env?)");
    }
  }
})();
