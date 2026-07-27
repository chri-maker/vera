// ============================================================
//  VERA SERVER — riceve i messaggi dal widget e risponde.
//  Usa il modulo http di Node: nessuna dipendenza, gira subito.
//  - MODALITÀ DEMO (senza chiavi): cervello + agenda finti.
//  - MODALITÀ VERA (con ANTHROPIC_API_KEY / Google): reali.
//  Avvio:  node src/server.js   →   http://localhost:3000/demo
// ============================================================
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handleMessage } from "./engine.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const PORT = process.env.PORT || 3000;
const DEMO = !process.env.ANTHROPIC_API_KEY;

// ---- carica le config studio ----
function loadStudio(id) {
  const f = join(ROOT, "studios", `${id}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f)) : null;
}

// ---- agenda finta per la demo: orari "puliti" in ora italiana, mai di domenica ----
const fakeCalendar = {
  async getFreeSlots() {
    const fmt = (d) => d.toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
    const at = (days, h, m) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      d.setUTCHours(h, m, 0, 0); // 8:00 UTC ≈ 10:00 in Italia (estate)
      if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); // mai di domenica
      return d;
    };
    return [at(1, 8, 0), at(1, 9, 30), at(2, 14, 0)].map((d) => ({ startISO: d.toISOString(), label: fmt(d) }));
  },
  async createEvent(_s, b) { return { id: "evt_demo_" + Date.now(), ...b }; },
};

// ---- scegli cervello e agenda in base alle chiavi disponibili ----
async function getDeps() {
  const brain = DEMO ? await import("./brain-stub.js") : await import("./brain.js");
  const calendar = DEMO || !process.env.GCAL_REFRESH_TOKEN ? fakeCalendar : await import("./calendar.js");
  return { brain, calendar };
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  if (Buffer.isBuffer(body) || typeof body === "string") res.end(body);
  else res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return send(res, 204, "");

  // widget e pagina demo (file statici)
  if (req.method === "GET" && (url.pathname === "/widget.js")) {
    return send(res, 200, readFileSync(join(ROOT, "public", "widget.js")), "application/javascript");
  }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/demo")) {
    return send(res, 200, readFileSync(join(ROOT, "public", "demo.html")), "text/html");
  }

  // API chat
  if (req.method === "POST" && url.pathname === "/api/chat") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      try {
        const { studioId = "studio-demo", message, history = [], from = "web" } = JSON.parse(raw || "{}");
        const studio = loadStudio(studioId);
        if (!studio) return send(res, 404, { error: "studio non trovato" });
        const deps = await getDeps();
        const out = await handleMessage({ studio, from, text: message, history }, deps);
        send(res, 200, out);
      } catch (e) {
        send(res, 500, { error: e.message });
      }
    });
    return;
  }
  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`\n🤖 Vera server su http://localhost:${PORT}/demo  ${DEMO ? "(MODALITÀ DEMO — cervello finto)" : "(AI VERA attiva)"}`);
});
