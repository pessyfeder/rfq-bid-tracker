// Setup wizard + product profile. Stored only in this browser (localStorage); nothing is sent to the server.
// The profile never hides, ranks or disqualifies a bid by itself: it only marks bids whose title / summary /
// category mention something the vendor sells, and powers the optional "Matches my products" filter.
(function () {
  var KEY = "rfqProfile", SKIP = "rfqProfileSkipped";

  // Product categories offered in step 2 (pre-filled from the vendor's website). Keywords are matched as whole words.
  var CATS = [
    { id: "it",      label: "Computers & software",        kw: ["computer", "laptop", "desktop", "tablet", "computer monitor", "software", "workstation"] },
    { id: "print",   label: "Printers, ink & toner",       kw: ["printer", "toner", "ink", "cartridge", "copier", "paper", "fax"] },
    { id: "elec",    label: "Consumer electronics",        kw: ["electronics", "headphone", "speaker", "camera", "telephone", "networking equipment", "usb cable", "hdmi", "gps"] },
    { id: "office",  label: "Office supplies & furniture", kw: ["office supplies", "office supply", "office furniture", "furniture", "filing", "stationery", "desk", "chair"] },
    { id: "jan",     label: "Janitorial & breakroom",      kw: ["janitorial", "sanitation", "cleaning supplies", "custodial", "breakroom", "paper towel", "trash bag", "disinfectant", "sanitizer"] },
    { id: "tools",   label: "Tools & hardware",            kw: ["tools", "hardware", "power tool", "hand tool", "fasteners", "housewares"] },
    { id: "auto",    label: "Automotive & marine",         kw: ["automotive", "marine", "boat", "vehicle accessories", "stereo"] },
    { id: "general", label: "General merchandise & sporting goods", kw: ["general merchandise", "household", "sporting goods", "camping", "toys", "fragrance"] },
    { id: "whole",   label: "Wholesale / drop ship",       kw: ["wholesale", "drop ship", "distributor", "end of life", "obsolete"] }
  ];

  var SOURCES = [
    { id: "fed", label: "Federal (SAM.gov)", reg: "SAM.gov entity registration",
      url: "https://sam.gov/content/entity-registration",
      steps: ["Get a free Unique Entity ID at SAM.gov (needs the legal business name and address).", "Complete the entity registration (NAICS codes, tax details, bank details for payment).", "Wait for approval; this can take a couple of weeks, so start early."] },
    { id: "tx", label: "Texas", reg: "Texas Centralized Master Bidders List (CMBL)",
      url: "https://comptroller.texas.gov/purchasing/vendor/cmbl/",
      steps: ["Register on the Texas Comptroller's Centralized Master Bidders List.", "Pick the product classes (commodity codes) you sell so you are notified of matching bids.", "Bids themselves are posted on the Texas ESBD (txsmartbuy.gov/esbd)."] },
    { id: "pa", label: "Pennsylvania", reg: "PA Supplier Portal / eMarketplace",
      url: "https://www.emarketplace.state.pa.us/",
      steps: ["Create a supplier account on the PA eMarketplace.", "Add your commodity codes and contact details.", "Check each bid for any extra vendor requirements."] },
    { id: "nyc", label: "New York City", reg: "NYC PASSPort",
      url: "https://www.nyc.gov/site/mocs/passport/about-passport.page",
      steps: ["Create a PASSPort account for your company.", "Complete the vendor profile (ownership, tax, and so on).", "Add the commodity categories you sell so you can respond to solicitations."] },
    { id: "other", label: "Other states", reg: "Each state's own portal",
      url: "", steps: ["Registration differs by state. Open a bid from that state and follow its own portal link."] }
  ];

  function load() { try { var p = JSON.parse(localStorage.getItem(KEY)); return p && typeof p === "object" ? p : null; } catch (e) { return null; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

  // ---------- matching ----------
  var cache = { key: "", res: [] };
  function keywords(p) {
    var out = [];
    if (!p) return out;
    (p.cats || []).forEach(function (id) { CATS.forEach(function (c) { if (c.id === id) out = out.concat(c.kw); }); });
    String(p.extra || "").split(/[,;\n]+/).forEach(function (k) { k = k.trim().toLowerCase(); if (k.length > 1) out.push(k); });
    return out.filter(function (k, i) { return out.indexOf(k) === i; });
  }
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function regexes(p) {
    var kws = keywords(p), key = kws.join("|");
    if (cache.key !== key) cache = { key: key, res: kws.map(function (k) { return { k: k, re: new RegExp("\\b" + esc(k).replace(/\s+/g, "\\s+") + "(?:s|es)?\\b", "i") }; }), ver: (cache.ver || 0) + 1 };
    return cache;
  }
  // Which of the vendor's keywords appear in a bid's title, summary or category? [] = none (or no profile).
  function match(r) {
    var p = load(); if (!p) return [];
    var c = regexes(p);
    if (r._pm && r._pm.v === c.ver) return r._pm.m;
    var text = [r.title, r.plainTitle, r.scope, r.category].filter(Boolean).join(" \n ");
    var m = c.res.filter(function (x) { return x.re.test(text); }).map(function (x) { return x.k; });
    r._pm = { v: c.ver, m: m };
    return m;
  }

  // ---------- UI ----------
  var css = document.createElement("style");
  css.textContent =
    "body.wz-open #app{display:none}" +
    ".wz-back{min-height:100vh;background:#f1f4f8;display:flex;align-items:center;justify-content:center;padding:20px;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".wz{background:#fff;color:#1f2937;border:1px solid #d9dfe7;border-radius:8px;max-width:660px;width:100%;padding:28px 32px;box-shadow:0 1px 3px rgba(15,23,42,.08)}" +
    ".wz-step{color:#64748b;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}" +
    ".wz-bar{height:3px;background:#e5e9f0;margin-bottom:20px;overflow:hidden}.wz-bar i{display:block;height:100%;background:#1e3a5f;transition:width .25s}" +
    ".wz h2{margin:0 0 10px;font-size:22px;font-weight:600;color:#0f2742}" +
    ".wz p{margin:8px 0}.wz label.wz-row{display:flex;gap:12px;align-items:center;padding:9px 12px;margin:6px 0;border:1px solid #d9dfe7;border-radius:6px;cursor:pointer}" +
    ".wz label.wz-row:hover{background:#f7f9fb}.wz label.wz-row:has(input:checked){border-color:#1e3a5f;background:#f0f4f9}" +
    ".wz input[type=checkbox],.wz input[type=radio]{width:16px;height:16px;accent-color:#1e3a5f;flex:none}" +
    ".wz textarea{width:100%;font:inherit;padding:9px 11px;border:1px solid #c5cdd8;border-radius:6px}.wz textarea:focus{outline:2px solid #1e3a5f33;border-color:#1e3a5f}" +
    ".wz .wz-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:26px;padding-top:18px;border-top:1px solid #e5e9f0;flex-wrap:wrap;align-items:center}" +
    ".wz button{font:inherit;font-weight:500;padding:8px 18px;border-radius:6px;border:1px solid #b8c2cf;background:#fff;color:#1f2937;cursor:pointer}.wz button:hover:not(:disabled){background:#f1f4f8}" +
    ".wz button:disabled{opacity:.4;cursor:default}" +
    ".wz button.pri{background:#1e3a5f;border-color:#1e3a5f;color:#fff}.wz button.pri:hover{background:#16304f}" +
    ".wz button.link{border:0;background:none!important;font-weight:400;color:#64748b;text-decoration:underline;margin-right:auto;padding:8px 0}" +
    ".wz .wz-src{border-radius:6px;padding:12px 16px;margin:12px 0;background:#f7f9fb;border:1px solid #d9dfe7;border-left:3px solid #b45309}.wz .wz-src b{display:block;margin-bottom:4px}" +
    ".wz .wz-src ol{margin:6px 0 0;padding-left:22px;color:#374151;font-size:14px}.wz .wz-seg{display:flex;gap:8px;flex-wrap:wrap}.wz .wz-seg label{flex:1;min-width:140px;display:flex;gap:8px;align-items:center;padding:9px 12px;border:1px solid #d9dfe7;border-radius:6px;cursor:pointer}.wz .wz-seg label:has(input:checked){border-color:#1e3a5f;background:#f0f4f9}" +
    ".wz .wz-note{color:#64748b;font-size:13px}.wz .wz-sum{list-style:none;padding:0}.wz .wz-sum li{margin:8px 0;padding:10px 14px;border-radius:6px;background:#f7f9fb;border:1px solid #e5e9f0}" +
    ".wz a{color:#1e3a5f;font-weight:600}" +
    ".match-chip{display:inline-block;background:#e3f4ea;color:#1d7a46;border-radius:4px;padding:1px 6px;margin:0 6px 0 0;font-size:12px;font-weight:600;cursor:help}";
  document.head.appendChild(css);

  var back = null;
  function close() { if (back) { back.remove(); back = null; document.body.classList.remove("wz-open"); window.dispatchEvent(new Event("rfqwizardclose")); } }
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function open() {
    var cur = load() || {};
    var d = { cats: (cur.cats || CATS.map(function (c) { return c.id; })).slice(), extra: cur.extra || "",
      src: (cur.src || ["fed", "tx", "pa", "nyc"]).slice(), reg: Object.assign({}, cur.reg || {}) };
    var step = 0;
    close();
    back = document.createElement("div"); back.className = "wz-back";
    document.body.insertBefore(back, document.body.firstChild); document.body.classList.add("wz-open"); window.scrollTo(0, 0);

    function skip() { try { if (!load()) localStorage.setItem(SKIP, "1"); } catch (e) {} close(); }
    function srcList() { return SOURCES.filter(function (s) { return d.src.indexOf(s.id) >= 0; }); }
    function steps() { return 4 + srcList().length; } // welcome, products, sources, [one per source], review

    function body() {
      var n = srcList().length, h2, html = "", i;
      if (step === 0) {
        h2 = "Welcome";
        html = "<p>This tracker lists government bids from many sources. A two-minute setup lets it point out the bids that look like what you sell, and shows what you still need to register for.</p>" +
          "<p class='wz-note'>Your answers stay in this browser. They never hide or rule out a bid; they only add a green &ldquo;Matches&rdquo; mark.</p>";
      } else if (step === 1) {
        h2 = "What do you sell?";
        html = "<p>Tick everything that applies (pre-filled from discovergroup.net).</p>" + CATS.map(function (c) {
          return "<label class='wz-row'><input type='checkbox' data-cat='" + c.id + "'" + (d.cats.indexOf(c.id) >= 0 ? " checked" : "") + "> <span>" + h(c.label) + "<br><span class='wz-note'>" + h(c.kw.slice(0, 4).join(", ")) + "&hellip;</span></span></label>";
        }).join("") + "<p>Anything else? Extra keywords, separated by commas:</p><textarea rows='2' id='wzExtra' placeholder='e.g. lanyards, batteries'>" + h(d.extra) + "</textarea>";
      } else if (step === 2) {
        h2 = "Where do you want to bid?";
        html = SOURCES.map(function (s) { return "<label class='wz-row'><input type='checkbox' data-src='" + s.id + "'" + (d.src.indexOf(s.id) >= 0 ? " checked" : "") + "> " + h(s.label) + "</label>"; }).join("");
      } else if (step >= 3 && step < 3 + n) {
        var s = srcList()[step - 3], st = d.reg[s.id] || "";
        h2 = h(s.label) + ": are you registered?";
        html = "<p>" + h(s.reg) + "</p><div class='wz-seg'>" +
          ["yes:Yes, already registered", "no:Not yet", "unsure:Not sure"].map(function (o) { var p = o.split(":"); return "<label><input type='radio' name='reg' value='" + p[0] + "'" + (st === p[0] ? " checked" : "") + "> " + p[1] + "</label>"; }).join("") + "</div>" +
          (st === "no" || st === "unsure" ? "<div class='wz-src'><b>How to get registered</b><ol>" + s.steps.map(function (x) { return "<li>" + h(x) + "</li>"; }).join("") + "</ol>" +
            (s.url ? "<p><a href='" + h(s.url) + "' target='_blank' rel='noopener'>Open the registration page &rarr;</a></p><p class='wz-note'>Links can change; if one fails, search the portal name.</p>" : "") + "</div>" : "");
      } else {
        h2 = "Review your setup";
        var todo = srcList().filter(function (s) { return d.reg[s.id] !== "yes"; });
        html = "<ul class='wz-sum'><li><b>Selling:</b> " + h(keywords({ cats: d.cats, extra: d.extra }).length ? d.cats.map(function (id) { return CATS.filter(function (c) { return c.id === id; })[0].label; }).concat(d.extra.trim() ? [d.extra.trim()] : []).join("; ") : "nothing selected") + "</li>" +
          "<li><b>Bidding in:</b> " + h(srcList().map(function (s) { return s.label; }).join(", ") || "none") + "</li>" +
          "<li><b>Still to register:</b> " + (todo.length ? h(todo.map(function (s) { return s.label + (d.reg[s.id] === "unsure" ? " (check)" : ""); }).join(", ")) : "nothing") + "</li></ul>" +
          "<p class='wz-note'>You can change these answers any time with &ldquo;Edit my profile&rdquo;.</p>";
      }
      return { h2: h2, html: html };
    }

    function draw() {
      var b = body(), total = steps(), last = step === total - 1;
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><div class='wz-step'>Step " + (step + 1) + " of " + total + "</div><div class='wz-bar'><i style='width:" + Math.round((step + 1) / total * 100) + "%'></i></div><h2>" + b.h2 + "</h2>" + b.html +
        "<div class='wz-btns'><button class='link' data-a='skip'>" + (load() ? "Cancel" : "Skip, just show me everything") + "</button>" + "<button data-a='back'" + (step ? "" : " disabled") + ">&larr; Back</button>" +
        "<button class='pri' data-a='" + (last ? "done" : "next") + "'>" + (last ? "Show my bids" : "Next &rarr;") + "</button></div></div>";
    }
    function collect() {
      Array.prototype.forEach.call(back.querySelectorAll("[data-cat]"), function (el, _i, all) { if (el === all[0]) d.cats = []; if (el.checked) d.cats.push(el.dataset.cat); });
      var ex = back.querySelector("#wzExtra"); if (ex) d.extra = ex.value;
      Array.prototype.forEach.call(back.querySelectorAll("[data-src]"), function (el, _i, all) { if (el === all[0]) d.src = []; if (el.checked) d.src.push(el.dataset.src); });
      var r = back.querySelector("input[name=reg]:checked"), n = srcList().length;
      if (r && step >= 3 && step < 3 + n) d.reg[srcList()[step - 3].id] = r.value;
    }
    back.addEventListener("change", function (e) {
      if (e.target.name === "reg") { collect(); draw(); } // show / hide the how-to for the chosen answer
    });
    back.addEventListener("click", function (e) {
      var a = e.target.closest("[data-a]"); if (!a) return;
      var act = a.dataset.a;
      if (act === "skip") return skip();
      collect();
      if (act === "back") step--;
      else if (act === "next") step++;
      else if (act === "done") {
        save({ cats: d.cats, extra: d.extra.trim(), src: d.src, reg: d.reg, saved: new Date().toISOString() });
        try { localStorage.removeItem(SKIP); } catch (x) {}
        close(); window.dispatchEvent(new Event("rfqprofilechange")); return;
      }
      draw();
    });
    draw();
  }

  function todo() {
    var p = load(); if (!p) return [];
    return SOURCES.filter(function (s) { return (p.src || []).indexOf(s.id) >= 0 && (p.reg || {})[s.id] !== "yes" && s.id !== "other"; })
      .map(function (s) { return { label: s.label, url: s.url, unsure: (p.reg || {})[s.id] === "unsure" }; });
  }
  window.RFQProfile = { get: load, match: match, open: open, todo: todo };
  // First visit: offer the setup once. (Skipping is remembered; the toolbar button reopens it.)
  window.addEventListener("load", function () {
    var skipped = false; try { skipped = !!localStorage.getItem(SKIP); } catch (e) {}
    if (!load() && !skipped) open();
  });
})();
