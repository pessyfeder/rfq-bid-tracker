// Main screen: a clean list of bids that look like what the vendor sells (from the setup wizard).
// The original full table still exists in index.html as a hidden data layer and is never shown.
(function () {
  var $app = document.getElementById("app");
  if (!$app) return;
  var DAY = 86400000, PAGE = 12;
  var st = { filter: "all", sort: "new", all: false, shown: PAGE, open: {}, regOpen: {} };

  var css = document.createElement("style");
  css.textContent =
    "body{background:#f1f4f8}" +
    ".hm{font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2937;max-width:1040px;margin:0 auto;padding:0 16px 60px}" +
    ".hm-hero{background:#0f2742;color:#fff;padding:18px 24px 22px;margin:0 -16px 20px}" +
    ".hm-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.15)}.hm-logo{font-weight:600;font-size:16px;letter-spacing:.02em;margin-right:auto}" +
    ".hm button{font:inherit;cursor:pointer}.hm-pill{border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:6px;padding:6px 14px;font-weight:500}.hm-pill:hover{background:rgba(255,255,255,.12)}" +
    ".hm-hero h1{margin:0 0 4px;font-size:24px;font-weight:600;line-height:1.25}.hm-hero p{margin:0;color:#c3cfdd}" +
    ".hm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;margin-top:20px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.15)}" +
    ".hm-stat{background:#0f2742;padding:12px 16px}.hm-stat b{display:block;font-size:24px;font-weight:600;line-height:1.15}.hm-stat span{font-size:12px;color:#a9b8ca;text-transform:uppercase;letter-spacing:.05em}" +
    ".hm-todo{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fff;border:1px solid #d9dfe7;border-left:3px solid #b45309;border-radius:6px;padding:10px 16px;margin-bottom:16px}" +
    ".hm-todo a{color:#1e3a5f;text-decoration:underline;font-weight:500}" +
    ".hm-reg{margin:8px 0;padding:8px 12px;background:#fdf6e9;border:1px solid #ecd9b0;border-left:3px solid #b45309;border-radius:6px;font-size:13px}.hm-reg.ok{background:#eef7f1;border-color:#cfe5d6;border-left-color:#1d6b3e;color:#1d6b3e}.hm-reg ol{margin:6px 0;padding-left:20px}.hm-reg a{color:#1e3a5f;font-weight:600}.hm-reg .hm-more{padding:2px 8px}" +
    ".hm-nudge{background:#fff;border:1px solid #d9dfe7;border-radius:6px;padding:16px;margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}" +
    ".hm-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px}" +
    ".hm-chip{border:1px solid #c5cdd8;background:#fff;color:#374151;border-radius:6px;padding:5px 14px;font-weight:500}.hm-chip:hover{background:#f7f9fb}.hm-chip.on{background:#1e3a5f;border-color:#1e3a5f;color:#fff}" +
    ".hm-bar select{font:inherit;border:1px solid #c5cdd8;border-radius:6px;padding:5px 10px;background:#fff;color:#374151;margin-left:auto}" +
    ".hm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}@media(max-width:800px){.hm-grid{grid-template-columns:1fr}}" +
    ".hm-card{background:#fff;border:1px solid #d9dfe7;border-radius:6px;padding:14px 18px 10px;margin-bottom:0;min-width:0;border-left:4px solid var(--c,#1e3a5f)}" +
    ".hm-card h3{margin:0 0 2px;font-size:16px;font-weight:600;line-height:1.35;color:#0f2742}.hm-sub{color:#64748b;font-size:13px}.hm-tag.posted{background:transparent;color:#94a3b8;font-size:11px;font-weight:400;padding:2px 0}" +
    ".hm-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}" +
    ".hm-tag{border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600;background:#eef1f5;color:#374151}" +
    ".hm-tag.Federal{background:#e3ecf7;color:#1e3a5f}.hm-tag.State{background:#eceaf5;color:#4a4a8a}.hm-tag.Local{background:#e1f0ee;color:#0f5f58}" +
    ".hm-tag.ok{background:#e6f2ea;color:#1d6b3e}.hm-tag.soon{background:#fbe9e7;color:#a12a1f}.hm-tag.mid{background:#fbf1de;color:#8a5a0b}.hm-tag.money{background:#eef1f5;color:#374151}.hm-tag.match{background:#e6f2ea;color:#1d6b3e}" +
    ".hm-go{display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:500;border-radius:6px;padding:6px 14px}.hm-go:hover{background:#16304f}" +
    ".hm-explore{display:inline-block;border:1px solid #1e3a5f;color:#1e3a5f;background:#fff;text-decoration:none;font-weight:500;border-radius:6px;padding:5px 14px}.hm-explore:hover{background:#eef3f9}" +
    ".hm-more{border:0;background:none;color:#1e3a5f;font-weight:500;text-decoration:underline;padding:6px}" +
    ".hm-scope{margin:8px 0 0;padding:10px 14px;background:#f7f9fb;border:1px solid #e5e9f0;border-radius:6px;font-size:14px}" +
    ".hm-empty{text-align:center;padding:40px 16px;background:#fff;border:1px solid #d9dfe7;border-radius:6px}" +
    ".hm-showmore{display:block;margin:6px auto;border:1px solid #b8c2cf;background:#fff;color:#1f2937;border-radius:6px;padding:8px 24px;font-weight:500}" +
    "@media (max-width:600px){.hm-hero h1{font-size:20px}.hm-bar select{margin-left:0}}";
  document.head.appendChild(css);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function safeUrl(u) { return /^https:\/\//i.test(String(u)) ? String(u) : ""; }
  function pDate(s) { var p = String(s).split("-"); return new Date(+p[0], p[1] - 1, +p[2]); }
  function fmtPosted(s) { s = String(s || ""); if (!s) return "date unknown"; var d = new Date(s.length > 10 ? s : s + "T00:00:00"); if (isNaN(d)) return s; var t = s.length > 10 && (d.getHours() || d.getMinutes()) ?", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""; return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + t; }
  function fmtDate(s) { return pDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  function money(n) { return n >= 1e6 ? "$" + +(n / 1e6).toFixed(1) + " million" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + n; }
  function nice(t) { // ALL-CAPS titles become readable
    t = String(t || "").replace(/[\u0000-\u001f]+/g, " ").trim();
    if (t.length > 8 && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[.:\-]\s*)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(?:[a-z]{1})/g, function (c, i, w) { return c; });
    return t;
  }

  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var cut = new Date(); cut.setFullYear(cut.getFullYear() + 3); var cutStr = cut.toISOString().slice(0, 10);
  var rows = null;
  function prep() {
    rows = (window.RFQS || []).map(function (r) {
      var noDue = !r.due || r.due > cutStr;
      var code = r.level === "Federal" ? "US" : String(r.id).split("-")[0].replace("TXDOT", "TX");
      var val = r.value != null ? r.value : r.valueEst && r.valueEst.kind === "stated" ? r.valueEst.amount : null;
      var w = (r.details && r.details.warnings) || [];
      return { raw: r, id: r.id, title: nice(r.plainTitle || (r.level === "Federal" && window.fedItemTitle ? window.fedItemTitle(r.title, r.scope) : r.title)), agency: nice(r.agency), level: r.level, code: code, noDue: noDue,
        days: noDue ? null : Math.round((pDate(r.due) - today) / DAY), due: r.due, posted: r.postedAt || r.posted, value: val, scope: r.scope || "",
        region: (r.details && r.details.region) || "", url: safeUrl(r.rfqUrl), old: w.indexOf("Posted over a year ago") !== -1 };
    }).filter(function (r) { return !(r.days != null && r.days < 0) && !r.old; });
  }

  function regBlock(r) {
    var P = window.RFQProfile, info = P && P.regInfo && P.regInfo(P.sourceFor(r.level, r.code));
    if (!info) return "";
    if (info.registered) return "";
    var open = st.regOpen[info.id];
    return '<div class="hm-reg"><b>Registration needed:</b> ' + esc(info.reg) + ' <button class="hm-more" data-r="' + info.id + '" data-v="1">I am registered</button>' +
      '<button class="hm-more" data-ro="' + info.id + '">' + (open ? "Hide how" : "How to register") + "</button>" +
      (open ? "<ol>" + info.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        (info.url ? '<a href="' + esc(info.url) + '" target="_blank" rel="noopener">Open the registration page &rarr;</a>' : "") : "") + "</div>";
  }

  function inSources(r, p) {
    var s = p && p.src; if (!s || !s.length) return true;
    return (r.level === "Federal" && s.indexOf("fed") >= 0) || (r.code === "TX" && s.indexOf("tx") >= 0) || (r.code === "PA" && s.indexOf("pa") >= 0) ||
      (r.code === "NYC" && s.indexOf("nyc") >= 0) || (r.level !== "Federal" && !{ TX: 1, PA: 1, NYC: 1 }[r.code] && s.indexOf("other") >= 0);
  }

  function render() {
    if (!window.RFQS) return;
    if (!rows) prep();
    var P = window.RFQProfile ? window.RFQProfile.get() : null;
    var scoped = rows.filter(function (r) { return inSources(r, P); });
    scoped.forEach(function (r) { r.m = P ? window.RFQProfile.match(r.raw) : []; });
    var matched = P ? scoped.filter(function (r) { return r.m.length; }) : scoped;
    var pool = P && !st.all ? matched : scoped;
    var list = pool.filter(function (r) {
      return st.filter === "all" || (st.filter === "soon" ? r.days != null && r.days <= 14 : r.level === st.filter);
    });
    list.sort(function (a, b) {
      if (st.sort === "value") return (b.value == null ? -1 : b.value) - (a.value == null ? -1 : a.value);
      if (st.sort === "new") return String(b.posted).localeCompare(String(a.posted));
      return (a.days == null ? 9e9 : a.days) - (b.days == null ? 9e9 : b.days);
    });

    var soon = pool.filter(function (r) { return r.days != null && r.days <= 14; }).length;
    var total = pool.reduce(function (s, r) { return s + (r.value || 0); }, 0);
    var states = {}; pool.forEach(function (r) { states[r.code] = 1; });
    var h = '<div class="hm"><div class="hm-hero"><div class="hm-top"><span class="hm-logo">Bid Finder</span>' +
      '<button class="hm-pill" data-a="profile">' + (P ? "Edit my profile" : "Set up my profile") + '</button><button class="hm-pill" data-a="refresh">Refresh</button></div>' +
      "<h1>" + (P ? "Bids matching your products" : "Find bids for your products") + "</h1>" +
      "<p>" + (P ? "Open government solicitations that mention your products, from the sources you selected." : "Complete a short setup to highlight bids that match what you sell.") + "</p>" +
      '<div class="hm-stats"><div class="hm-stat"><b>' + pool.length + "</b><span>" + (P && !st.all ? "matching open bids" : "open bids") + '</span></div>' +
      '<div class="hm-stat"><b>' + soon + "</b><span>closing within 2 weeks</span></div>" +
      '<div class="hm-stat"><b>' + (total ? money(total) : "–") + "</b><span>total of published values</span></div>" +
      '<div class="hm-stat"><b>' + Object.keys(states).length + "</b><span>jurisdictions</span></div></div></div>";

    if (!P) {
      h += '<div class="hm-nudge"><div style="flex:1;min-width:200px"><b>Set up your profile.</b><br><span class="hm-sub">Takes about two minutes.</span></div><button class="hm-go" style="border:0" data-a="profile">Start setup</button></div>';
    }

    h += '<div class="hm-bar">' + [["all", "All"], ["soon", "Closing soon"], ["Federal", "Federal"], ["State", "State"], ["Local", "Local"]].map(function (f) {
      return '<button class="hm-chip' + (st.filter === f[0] ? " on" : "") + '" data-f="' + f[0] + '">' + f[1] + "</button>"; }).join("") +
      '<select data-s aria-label="Sort"><option value="soon"' + (st.sort === "soon" ? " selected" : "") + '>Closing soonest</option><option value="value"' + (st.sort === "value" ? " selected" : "") + '>Biggest value</option><option value="new"' + (st.sort === "new" ? " selected" : "") + ">Newest</option></select></div>";

    if (!list.length) {
      h += '<div class="hm-empty"><h3>No bids to show right now</h3><p class="hm-sub">' + (P && !st.all && scoped.length ? "Nothing matches your products with these filters." : "Try a different filter.") + "</p>" +
        (P && !st.all && scoped.length ? '<button class="hm-go" style="border:0" data-a="all">Show all bids in my chosen places</button>' : "") + "</div>";
    }
    h += '<div class="hm-grid">';
    list.slice(0, st.shown).forEach(function (r) {
      var color = r.level === "Federal" ? "#2563eb" : r.level === "Local" ? "#0d9488" : "#7c3aed";
      var dTag = r.days == null ? '<span class="hm-tag">No firm deadline</span>' : '<span class="hm-tag ' + (r.days <= 7 ? "soon" : r.days <= 21 ? "mid" : "ok") + '">' +
        (r.days === 0 ? "Due today" : r.days === 1 ? "1 day left" : r.days + " days left") + " · " + esc(fmtDate(r.due)) + "</span>";
      h += '<div class="hm-card" style="--c:' + color + '"><h3>' + esc(r.title) + '</h3><div class="hm-sub">' + esc(r.agency) + (r.region ? " · " + esc(r.region) : "") + "</div>" +
        '<div class="hm-row"><span class="hm-tag ' + esc(r.level) + '">' + esc(r.level) + "</span>" + dTag +
        (r.value ? '<span class="hm-tag money">' + esc(money(r.value)) + "</span>" : "") +
        (r.m && r.m.length ? '<span class="hm-tag match">Matches: ' + esc(r.m.slice(0, 3).join(", ")) + "</span>" : "") +
        '<span class="hm-tag posted">Posted ' + esc(fmtPosted(r.posted)) + "</span></div>" +
        regBlock(r) +
        (st.open[r.id] && r.scope ? '<div class="hm-scope">' + esc(r.scope) + "</div>" : "") +
        '<div class="hm-row">' + (r.url ? '<a class="hm-go" href="' + esc(r.url) + '" target="_blank" rel="noopener">View solicitation</a>' : "") +
        (r.scope ? '<button class="hm-more" data-o="' + esc(r.id) + '">' + (st.open[r.id] ? "Hide summary" : "Show summary") + "</button>" : "") +
        '<a class="hm-explore" href="/explore.html?id=' + encodeURIComponent(r.id) + '">Explore this request</a></div></div>';
    });
    h += "</div>";
    if (list.length > st.shown) h +='<button class="hm-showmore" data-a="more">Show more (' + (list.length - st.shown) + " left)</button>";
    if (P && !st.all && scoped.length > matched.length && list.length) h += '<p style="text-align:center"><button class="hm-more" data-a="all">Also show the ' + (scoped.length - matched.length) + " other bids in my places</button></p>";
    if (P && st.all) h += '<p style="text-align:center"><button class="hm-more" data-a="matches">Show only bids that match my products</button></p>';
    h += "</div>";
    $app.innerHTML = h;
  }

  $app.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    if (d.a === "profile") return window.RFQProfile.open();
    if (d.a === "refresh") { var rb = document.getElementById("refreshBtn"); if (rb) rb.click(); b.textContent = "Refreshing…"; return; }
    if (d.a === "all") st.all = true; else if (d.a === "matches") st.all = false;
    else if (d.a === "more") st.shown += PAGE;
    else if (d.f) { st.filter = d.f; st.shown = PAGE; }
    else if (d.o) st.open[d.o] = !st.open[d.o];
    else if (d.ro) st.regOpen[d.ro] = !st.regOpen[d.ro];
    else if (d.r) window.RFQProfile.setReg(d.r, d.v === "1");
    else return;
    render();
  });
  $app.addEventListener("change", function (e) { if (e.target.dataset.s != null) { st.sort = e.target.value; st.shown = PAGE; render(); } });
  window.addEventListener("rfqprofilechange", function () { st.all = false; render(); });
  window.addEventListener("rfqwizardclose", render);
  render();
})();
