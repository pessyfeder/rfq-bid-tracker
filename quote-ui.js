// Quote Helper panel for the bid details page: a three-step guided chat (costs, terms, attachments).
// window.QuoteHelper.mount(el, { id, demo }) - safe to call again after the page redraws; the conversation is kept
// per bid in this browser (localStorage) so a reload does not lose it. Replies come from POST /api/quote-helper.
(function () {
  var STEPS = [
    { id: "costs", label: "1. Costs", title: "Calculate your true cost",
      intro: "Let's work out what this job really costs you and what to charge. I'll ask for your numbers one or two at a time: unit costs, materials, labor, shipping and logistics, taxes or tariffs, overhead, and your profit margin.",
      start: "Let's start with step 1, costs. Walk me through working out my true cost and price for this bid." },
    { id: "terms", label: "2. Terms", title: "State clear terms",
      intro: "Next, the terms: how long your price is good for, delivery lead time, warranty, and what to say if you can't meet the requested delivery date.",
      start: "Let's move to step 2, terms. Help me state price validity, delivery lead time, warranty, and any exceptions for this bid." },
    { id: "attachments", label: "3. Attachments", title: "Gather your attachments",
      intro: "Finally, the paperwork: the forms, certifications and registration documents to attach to your quote.",
      start: "Let's move to step 3, attachments. Build me a checklist of the forms, certifications and business registration documents to attach for this bid." }
  ];
  var CSS =
    ".qh-launch{margin-top:26px}" +
    ".qh-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".qh-overlay .qh{position:relative;margin:0;width:100%;max-width:640px;max-height:calc(100vh - 32px);overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.35)}" +
    ".qh-x{position:absolute;top:8px;right:10px;font:inherit;font-size:24px;line-height:1;border:0;background:none;color:#64748b;cursor:pointer;padding:4px 8px}.qh-x:hover{color:#14284b}" +
    ".qh{border:1px solid #d9dcf5;border-radius:12px;background:#fafbff;padding:2px 16px 16px}" +
    ".qh h2{margin:14px 0 4px}.qh .qh-sub{color:#64748b;font-size:13px;margin:0 0 10px}" +
    ".qh-steps{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}" +
    ".qh-step{font:inherit;font-size:13px;font-weight:600;padding:5px 12px;border-radius:999px;border:1px solid #d9dcf5;background:#fff;color:#14284b;cursor:pointer}" +
    ".qh-step:hover{background:#eef0ff}.qh-step.on{background:#14284b;border-color:#14284b;color:#fff}" +
    ".qh-log{max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px}" +
    ".qh-m{padding:9px 12px;border-radius:10px;font-size:14px;line-height:1.5;overflow-wrap:anywhere;max-width:92%}" +
    ".qh-m.bot{background:#fff;border:1px solid #e4e4f0;align-self:flex-start}.qh-m.me{background:#eef0ff;border:1px solid #d9dcf5;align-self:flex-end;white-space:pre-wrap}" +
    ".qh-m ul{margin:4px 0;padding-left:20px}.qh-m p{margin:0 0 6px}.qh-m p:last-child{margin-bottom:0}" +
    ".qh-m.err{background:#fdecea;border-color:#f4c7c2;color:#b42318}.qh-m.wait{color:#64748b;font-style:italic}" +
    ".qh-form{display:flex;gap:8px;margin-top:10px;align-items:flex-end}" +
    ".qh-form textarea{flex:1;font:inherit;font-size:14px;padding:8px 10px;border:1px solid #cfd4e8;border-radius:8px;resize:vertical;min-height:40px;max-height:160px}" +
    ".qh-btn{font:inherit;font-weight:700;padding:9px 16px;border-radius:8px;border:0;background:#14284b;color:#fff;cursor:pointer}" +
    ".qh-btn:disabled{background:#c9d1dc;cursor:default}" +
    ".qh-link{font:inherit;font-size:12px;border:0;background:none;color:#4338ca;text-decoration:underline;cursor:pointer;padding:0;margin-top:8px}" +
    ".qh-note{color:#64748b;font-size:12px;margin-top:8px}";

  var busy = false;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inline(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>"); }
  // Tiny safe markdown: paragraphs, "- " / "* " / "1. " lists, **bold**. Everything is escaped first.
  function md(text) {
    var out = "", list = false;
    String(text).split(/\r?\n/).forEach(function (line) {
      var m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (m) { if (!list) { out += "<ul>"; list = true; } out += "<li>" + inline(m[1]) + "</li>"; return; }
      if (list) { out += "</ul>"; list = false; }
      if (line.trim()) out += "<p>" + inline(line.replace(/^#+\s*/, "")) + "</p>";
    });
    return out + (list ? "</ul>" : "");
  }
  function key(id) { return "quoteHelper:" + id; }
  function load(id) { try { var s = JSON.parse(localStorage.getItem(key(id))); return s && Array.isArray(s.messages) ? s : null; } catch (e) { return null; } }
  function save(id, s) { try { localStorage.setItem(key(id), JSON.stringify(s)); } catch (e) {} }

  function mount(el, opts) {
    if (!el) return;
    if (!document.getElementById("qh-css")) { var st = document.createElement("style"); st.id = "qh-css"; st.textContent = CSS; document.head.appendChild(st); }
    el.className = "qh-launch";
    el.innerHTML = '<button type="button" class="qh-btn qh-open">Build your quote with AI helper</button>';
    el.querySelector("button").onclick = function () { openModal(opts); };
  }

  function openModal(opts) {
    if (document.querySelector(".qh-overlay")) return;
    var overlay = document.createElement("div"); overlay.className = "qh-overlay";
    var el = document.createElement("div"); el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    overlay.appendChild(el); document.body.appendChild(overlay);
    var prevFocus = document.activeElement;
    function close() { document.removeEventListener("keydown", onKey); overlay.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    build(el, opts, close);
    var ta = el.querySelector("textarea"); if (ta && !ta.disabled) ta.focus();
  }

  function build(el, opts, close) {
    var id = opts.id, S = load(id) || { step: 0, messages: [] };
    el.className = "qh";
    el.innerHTML = '<button type="button" class="qh-x" aria-label="Close">&times;</button><h2>Build your quote</h2><p class="qh-sub">An AI helper walks you through the three parts of a good quote. It knows this bid\'s requirements, so it can point out costs and paperwork the notice asks for.</p>' +
      '<div class="qh-steps"></div><div class="qh-log" aria-live="polite"></div>' +
      '<form class="qh-form"><textarea rows="2" placeholder="Type your answer or a question&hellip;" aria-label="Message to the quote helper"></textarea><button class="qh-btn" type="submit">Send</button></form>' +
      '<button type="button" class="qh-link">Start over</button>' +
      '<div class="qh-note">AI guidance, not legal or tax advice. It can make mistakes: check every figure and requirement against the bid documents. What you type is sent to Anthropic to get the answer; it is not stored on the service.</div>';
    var stepsEl = el.querySelector(".qh-steps"), log = el.querySelector(".qh-log"), form = el.querySelector("form"), box = form.querySelector("textarea"), send = form.querySelector("button");
    if (opts.demo) { box.disabled = send.disabled = true; box.placeholder = "The helper is not available in the public demo."; }

    function renderSteps() {
      stepsEl.innerHTML = "";
      STEPS.forEach(function (s, i) {
        var b = document.createElement("button"); b.type = "button"; b.className = "qh-step" + (i === S.step ? " on" : ""); b.textContent = s.label; b.title = s.title;
        b.onclick = function () { if (busy) return; S.step = i; save(id, S); renderSteps(); if (!S.messages.length || S.messages[S.messages.length - 1].step !== i) ask(s.start, i); };
        stepsEl.appendChild(b);
      });
    }
    function bubble(cls, html) { var d = document.createElement("div"); d.className = "qh-m " + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
    function renderLog() {
      log.innerHTML = "";
      if (!S.messages.length) bubble("bot", "<p>" + esc(STEPS[S.step].intro) + "</p>" + (opts.demo ? "" : "<p>Pick a step above, or press <b>1. Costs</b> to begin.</p>"));
      S.messages.forEach(function (m) { bubble(m.role === "user" ? "me" : "bot", m.role === "user" ? esc(m.content) : md(m.content)); });
    }
    function ask(text, step) {
      if (busy || opts.demo) return;
      S.messages.push({ role: "user", content: text, step: step == null ? S.step : step });
      save(id, S); renderLog(); busy = true; send.disabled = true;
      var wait = bubble("bot wait", "Thinking&hellip;");
      fetch("/api/quote-helper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, messages: S.messages.map(function (m) { return { role: m.role, content: m.content }; }) }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "The helper is unavailable (" + r.status + ")."); return j; }); })
        .then(function (j) { S.messages.push({ role: "assistant", content: j.reply, step: S.step }); save(id, S); renderLog(); })
        .catch(function (e) { S.messages.pop(); save(id, S); renderLog(); bubble("err", esc(/Failed to fetch/i.test(e.message) ? "Could not reach the service." : e.message)); box.value = text; })
        .then(function () { busy = false; send.disabled = false; });
    }
    form.onsubmit = function (e) { e.preventDefault(); var t = box.value.trim(); if (!t || busy) return; box.value = ""; ask(t); };
    box.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
    el.querySelector(".qh-link").onclick = function () { if (busy) return; S = { step: 0, messages: [] }; save(id, S); renderSteps(); renderLog(); };
    el.querySelector(".qh-x").onclick = close;
    renderSteps(); renderLog();
  }
  window.QuoteHelper = { mount: mount, md: md };
})();
