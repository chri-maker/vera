// ============================================================
//  VERA WIDGET — la bollina di chat da mettere sul sito.
//  Installazione per lo studio = UNA riga:
//  <script src="https://TUO-SERVER/widget.js" data-studio="studio-mario"></script>
// ============================================================
(function () {
  var me = document.currentScript;
  var API = new URL(me.src).origin;
  var STUDIO = me.getAttribute("data-studio") || "studio-demo";
  var GRAD = "linear-gradient(100deg,#35d0ff,#7b6bff 46%,#ff5cc8)";
  var history = [];

  // ---- stili ----
  var css = document.createElement("style");
  css.textContent = `
  .vera-btn{position:fixed;bottom:22px;right:22px;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;
    background:${GRAD};color:#08080c;font:800 26px/1 Manrope,Arial,sans-serif;box-shadow:0 12px 34px -6px rgba(123,107,255,.6);
    z-index:2147483000;transition:transform .2s}
  .vera-btn:hover{transform:scale(1.06)}
  .vera-panel{position:fixed;bottom:96px;right:22px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 130px);
    background:#0c0c12;border:1px solid rgba(255,255,255,.14);border-radius:20px;overflow:hidden;display:none;flex-direction:column;
    box-shadow:0 30px 80px -20px rgba(0,0,0,.7);z-index:2147483000;font-family:Manrope,-apple-system,Segoe UI,Arial,sans-serif}
  .vera-panel.open{display:flex}
  .vera-hd{display:flex;align-items:center;gap:11px;padding:15px 17px;background:#12121b;border-bottom:1px solid rgba(255,255,255,.08)}
  .vera-av{width:38px;height:38px;border-radius:50%;background:${GRAD};display:flex;align-items:center;justify-content:center;color:#08080c;font-weight:800;font-size:18px}
  .vera-hd b{color:#fff;font-size:15.5px;display:block;line-height:1.1}
  .vera-hd span{color:#2ee6a0;font-size:12px;font-weight:600}
  .vera-hd i{width:6px;height:6px;border-radius:50%;background:#2ee6a0;display:inline-block;margin-right:5px}
  .vera-x{margin-left:auto;background:none;border:0;color:#8a8b98;font-size:22px;cursor:pointer;line-height:1}
  .vera-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#0a0a10}
  .vera-msg{max-width:80%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap}
  .vera-in{align-self:flex-start;background:#22222c;color:#e9e9ee;border-bottom-left-radius:4px}
  .vera-out{align-self:flex-end;background:${GRAD};color:#08080c;font-weight:500;border-bottom-right-radius:4px}
  .vera-typing{align-self:flex-start;color:#8a8b98;font-size:13px;padding:4px 6px}
  .vera-ft{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08);background:#0c0c12}
  .vera-ft input{flex:1;background:#1a1a22;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:100px;padding:11px 15px;font-size:14px;outline:none}
  .vera-ft button{background:${GRAD};border:0;border-radius:50%;width:42px;height:42px;cursor:pointer;color:#08080c;font-size:18px;flex-shrink:0}
  .vera-cred{text-align:center;font-size:11px;color:#5a5b68;padding:0 0 8px;background:#0c0c12}
  .vera-cred b{background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent}`;
  document.head.appendChild(css);

  // ---- DOM ----
  var btn = el("button", "vera-btn", "V");
  var panel = el("div", "vera-panel");
  panel.innerHTML = `
    <div class="vera-hd"><div class="vera-av">V</div><div><b>Vera</b><span><i></i>online ora</span></div><button class="vera-x">×</button></div>
    <div class="vera-body"></div>
    <div class="vera-cred">powered by <b>Vera</b></div>
    <div class="vera-ft"><input placeholder="Scrivi un messaggio…" /><button aria-label="Invia">➤</button></div>`;
  document.body.appendChild(btn); document.body.appendChild(panel);
  var body = panel.querySelector(".vera-body");
  var input = panel.querySelector("input");

  btn.onclick = function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open") && !history.length) {
      add("in", "Buongiorno 👋 Sono Vera, l'assistente dello studio. Mi scriva pure cosa le serve — un appuntamento, un'informazione — ci penso io.");
    }
    input.focus();
  };
  panel.querySelector(".vera-x").onclick = function () { panel.classList.remove("open"); };
  panel.querySelector(".vera-ft button").onclick = sendMsg;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendMsg(); });

  function sendMsg() {
    var t = input.value.trim(); if (!t) return;
    add("out", t); input.value = "";
    history.push({ role: "user", content: t });
    var typing = el("div", "vera-typing", "Vera sta scrivendo…"); body.appendChild(typing); scroll();
    fetch(API + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioId: STUDIO, message: t, history: history }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typing.remove();
        add("in", d.reply || "Mi scusi, riprovo tra un attimo.");
        history.push({ role: "assistant", content: d.reply || "" });
      })
      .catch(function () { typing.remove(); add("in", "Connessione assente, riprovi tra poco 🙏"); });
  }

  function add(kind, text) { var m = el("div", "vera-msg vera-" + kind, text); body.appendChild(m); scroll(); }
  function scroll() { body.scrollTop = body.scrollHeight; }
  function el(tag, cls, txt) { var e = document.createElement(tag); e.className = cls; if (txt) e.textContent = txt; return e; }
})();
