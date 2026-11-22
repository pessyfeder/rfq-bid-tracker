// "My bids": the part of the app that starts once a vendor decides to bid.
// A vendor marks a notice as Tracking; here each tracked bid gets a stage, a to-do checklist, notes and a deadline reminder.
// Everything is kept in this browser (localStorage). Each entry stores a copy of the notice's title, agency, due date and link,
// so a bid stays on the list after the notice drops out of the live data.
// API for the main page (home.js): window.RFQBids = { has, toggle, count, dueSoon, open }; it fires "rfqbidschange" on any change.
(function () {
  var KEY = "rfq-my-bids", DAY = 86400000;
  var STAGES = [["pursuing", "Preparing a bid"], ["submitted", "Submitted"], ["won", "Won"], ["lost", "Lost"], ["passed", "Decided not to bid"]];
  var CHECKS = [
    ["reg", "Registered on the agency's portal"],
    ["read", "Read the full solicitation"],
    ["ask", "Questions sent to the contact"],
    ["prep", "Quote / bid prepared"],
    ["sub", "Submitted before the deadline"]
  ];
  function activeStage(s) { return s === "pursuing"; }

  function load() { try { var d = JSON.parse(localStorage.getItem(KEY) || "{}"); return d && typeof d === "object" ? d : {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} fire(); }
  function fire() { try { window.dispatchEvent(new Event("rfqbidschange")); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function safeUrl(u) { return /^https:\/\//i.test(String(u)) ? String(u) : ""; }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function daysLeft(due) { // null = no firm deadline
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(due || "")); if (!m) return null;
    return Math.round((new Date(+m[1], m[2] - 1, +m[3]) - today()) / DAY);
  }
  function mdy(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[2] + "/" + m[3] + "/" + m[1] : "No firm deadline"; }
  function left(d) { return d == null ? "" : d < 0 ? "Closed" : d === 0 ? "closes today" : d === 1 ? "closes tomorrow" : d + " days left"; }

  var api = window.RFQBids = {
    has: function (id) { return !!load()[id]; },
    count: function () { return Object.keys(load()).filter(function (k) { return activeStage(load()[k].stage); }).length; },
    // Bids still being prepared that close within `n` days (default 7), soonest first.
    dueSoon: function (n) {
      var d = load(), lim = n == null ? 7 : n;
      return Object.keys(d).map(function (k) { return d[k]; }).filter(function (b) { var l = daysLeft(b.due); return activeStage(b.stage) && l != null && l >= 0 && l <= lim; })
        .sort(function (a, b) { return daysLeft(a.due) - daysLeft(b.due); });
    },
    // snap = { id, title, agency, where, due, url }; tracks it, or stops tracking it when it is already tracked.
    toggle: function (snap) {
      var d = load();
      if (d[snap.id]) delete d[snap.id];
      else d[snap.id] = { id: snap.id, title: snap.title || snap.id, agency: snap.agency || "", where: snap.where || "", due: snap.due || "", url: safeUrl(snap.url), stage: "pursuing", checks: {}, notes: "", added: new Date().toISOString() };
      save(d); return !!d[snap.id];
    },
    open: function () { openPanel(); }
  };

  // ---------- panel ----------
  var css = document.createElement("style");
  css.textContent =
    "#mb-back{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .25s}#mb-back.on{opacity:1;pointer-events:auto}" +
    "#mb{position:fixed;top:0;right:0;bottom:0;width:min(640px,100vw);z-index:1001;background:#f7f7fc;box-shadow:-8px 0 30px rgba(15,23,42,.25);transform:translateX(100%);transition:transform .28s ease;display:flex;flex-direction:column;font:13px/1.45 system-ui,sans-serif;color:#1f3347}#mb.on{transform:none}#mb *{box-sizing:border-box}" +
    "#mb .mb-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#fff;border-bottom:1px solid #e4e4f0}#mb .mb-bar h2{margin:0;font-size:17px;color:#27264f}#mb .mb-bar button{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#64748b}" +
    "#mb .mb-body{flex:1;overflow:auto;padding:14px 20px 40px}" +
    "#mb .mb-intro,#mb .mb-empty{color:#64748b;margin:0 0 12px}#mb .mb-empty{text-align:center;padding:40px 10px;background:#fff;border:1px dashed #cfd5de;border-radius:10px}" +
    "#mb .mb-alert{background:#fdecea;border:1px solid #f3b8b3;color:#8a1c14;border-radius:10px;padding:10px 14px;margin-bottom:12px}#mb .mb-alert b{display:block;margin-bottom:2px}#mb .mb-alert.warn{background:#fff3cd;border-color:#ecd48a;color:#6b4e00}#mb .mb-alert div{margin-top:2px}" +
    "#mb .mb-card{background:#fff;border:1px solid #e4e4f0;border-left:4px solid #4338ca;border-radius:10px;padding:12px 14px;margin-bottom:12px}#mb .mb-card.done{border-left-color:#94a3b8;opacity:.85}" +
    "#mb .mb-card h3{margin:0;font-size:14px;line-height:1.3}#mb .mb-card h3 a{color:#27264f;text-decoration:none}#mb .mb-card h3 a:hover{text-decoration:underline}" +
    "#mb .mb-sub{color:#6b7280;font-size:12px;margin-top:2px}#mb .mb-due{margin-top:6px;font-size:12.5px}#mb .mb-due .l{font-weight:700;color:#4338ca}#mb .mb-due .l.soon{color:#c62828}" +
    "#mb .mb-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}#mb select{height:30px;border:1px solid #cfd5de;border-radius:6px;background:#fff;padding:0 8px;font:inherit;color:#2d3a48}" +
    "#mb .mb-prog{font-size:12px;color:#64748b;margin-left:auto}" +
    "#mb .mb-checks{margin:8px 0 0;padding:0;list-style:none}#mb .mb-checks label{display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer}#mb .mb-checks input{width:16px;height:16px;accent-color:#4338ca;margin:0}#mb .mb-checks .on{color:#64748b;text-decoration:line-through}" +
    "#mb textarea{width:100%;min-height:54px;margin-top:8px;border:1px solid #cfd5de;border-radius:6px;padding:7px 9px;font:inherit;color:#1f3347;resize:vertical}#mb textarea:focus{outline:2px solid #4338ca55;border-color:#4338ca}" +
    "#mb .mb-links{display:flex;gap:14px;margin-top:8px;font-size:12.5px}#mb .mb-links a,#mb .mb-links button{color:#4338ca;background:none;border:0;padding:0;font:inherit;text-decoration:underline;cursor:pointer}#mb .mb-links button.rm{color:#b3261e;margin-left:auto}" +
    ".hm-track{border:0;background:none;color:#4338ca;font-weight:600;font-size:12.5px;padding:3px 0 0;cursor:pointer}.hm-track:hover{text-decoration:underline}.hm-track.on{color:#1b7a34}" +
    ".hm-badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:999px;background:#4338ca;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center}.hm-badge.due{background:#c62828}";
  document.head.appendChild(css);

  var back, panel, body, built = false;
  function build() {
    if (built) return; built = true;
    back = document.createElement("div"); back.id = "mb-back";
    panel = document.createElement("div"); panel.id = "mb"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "My bids");
    panel.innerHTML = '<div class="mb-bar"><h2>My bids</h2><button type="button" aria-label="Close" data-mb="close">&times;</button></div><div class="mb-body"></div>';
    body = panel.querySelector(".mb-body");
    document.body.appendChild(back); document.body.appendChild(panel);
    back.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("on")) closePanel(); });
    panel.addEventListener("click", function (e) {
      var t = e.target.closest("[data-mb]"); if (!t) return;
      if (t.dataset.mb === "close") return closePanel();
      if (t.dataset.mb === "rm") {
        var d = load(), b = d[t.dataset.id];
        if (b && window.confirm("Stop tracking “" + b.title + "”? Its checklist and notes will be deleted.")) { delete d[t.dataset.id]; save(d); draw(); }
      }
    });
    panel.addEventListener("change", function (e) {
      var t = e.target, id = t.dataset.id; if (!id) return;
      var d = load(); if (!d[id]) return;
      if (t.dataset.mb === "stage") d[id].stage = t.value;
      else if (t.dataset.mb === "chk") { if (t.checked) d[id].checks[t.dataset.k] = 1; else delete d[id].checks[t.dataset.k]; }
      else return;
      save(d); draw();
    });
    var timer;
    panel.addEventListener("input", function (e) { // notes save as you type, without redrawing (which would drop the cursor)
      var t = e.target; if (t.dataset.mb !== "notes") return;
      clearTimeout(timer); timer = setTimeout(function () { var d = load(); if (d[t.dataset.id]) { d[t.dataset.id].notes = t.value; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (x) {} } }, 300);
    });
  }
  function closePanel() { if (!panel) return; back.classList.remove("on"); panel.classList.remove("on"); }
  function openPanel() { build(); draw(); back.classList.add("on"); panel.classList.add("on"); }

  function card(b) {
    var l = daysLeft(b.due), act = activeStage(b.stage), n = CHECKS.filter(function (c) { return b.checks && b.checks[c[0]]; }).length;
    var soon = act && l != null && l >= 0 && l <= 3;
    return '<div class="mb-card' + (act ? "" : " done") + '"><h3><a href="explore.html?id=' + encodeURIComponent(b.id) + '" target="_blank" rel="noopener">' + esc(b.title) + "</a></h3>" +
      '<div class="mb-sub">' + esc([b.where, b.agency].filter(Boolean).join(" · ")) + "</div>" +
      '<div class="mb-due">Closing <b>' + esc(mdy(b.due)) + "</b>" + (l != null ? ' <span class="l' + (soon ? " soon" : "") + '">' + esc(left(l)) + "</span>" : "") + "</div>" +
      '<div class="mb-row"><label>Stage <select data-mb="stage" data-id="' + esc(b.id) + '">' + STAGES.map(function (s) { return '<option value="' + s[0] + '"' + (b.stage === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select></label>" +
      '<span class="mb-prog">' + n + " of " + CHECKS.length + " steps done</span></div>" +
      '<ul class="mb-checks">' + CHECKS.map(function (c) { var on = b.checks && b.checks[c[0]]; return '<li><label class="' + (on ? "on" : "") + '"><input type="checkbox" data-mb="chk" data-id="' + esc(b.id) + '" data-k="' + c[0] + '"' + (on ? " checked" : "") + "> " + esc(c[1]) + "</label></li>"; }).join("") + "</ul>" +
      '<textarea data-mb="notes" data-id="' + esc(b.id) + '" placeholder="Notes: portal login, contact you spoke to, price you quoted...">' + esc(b.notes || "") + "</textarea>" +
      '<div class="mb-links">' + (b.url ? '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">Open the posting</a>' : "") + '<button type="button" class="rm" data-mb="rm" data-id="' + esc(b.id) + '">Stop tracking</button></div></div>';
  }
  function draw() {
    if (!built) return;
    var d = load(), all = Object.keys(d).map(function (k) { return d[k]; });
    var keep = body.scrollTop;
    all.sort(function (a, b) { // active first, then by closing date (no deadline last)
      if (activeStage(a.stage) !== activeStage(b.stage)) return activeStage(a.stage) ? -1 : 1;
      var x = daysLeft(a.due), y = daysLeft(b.due); return (x == null ? 9e9 : x) - (y == null ? 9e9 : y);
    });
    var h = "";
    var soon = api.dueSoon(7);
    if (soon.length) {
      var urgent = soon.some(function (b) { return daysLeft(b.due) <= 3; });
      h += '<div class="mb-alert' + (urgent ? "" : " warn") + '"><b>Closing soon</b>' + soon.map(function (b) { return "<div>" + esc(b.title) + " – " + esc(left(daysLeft(b.due))) + " (" + esc(mdy(b.due)) + ")</div>"; }).join("") + "</div>";
    }
    if (!all.length) h += '<div class="mb-empty"><b>No tracked bids yet.</b><br>Click “Track this bid” on any notice to start a checklist, notes and a closing-date reminder for it.</div>';
    else h += '<p class="mb-intro">Saved in this browser. Tick the steps off as you go, and change the stage when you submit or hear back.</p>' + all.map(card).join("");
    body.innerHTML = h; body.scrollTop = keep;
  }
  window.addEventListener("rfqbidschange", function () { if (built && panel.classList.contains("on")) draw(); });
})();
