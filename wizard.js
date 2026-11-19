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

  // Categories for the home screen's Category filter: the product categories, plus the vendor's own extra keywords (if any).
  // catHits(r) -> { categoryId: [keywords found in the bid's title / summary / category] } for every category that matches.
  function categories() {
    var p = load(), out = CATS.map(function (c) { return { id: c.id, label: c.label, kw: c.kw }; });
    var ex = keywords({ cats: [], extra: p && p.extra });
    if (ex.length) out.push({ id: "extra", label: "My own keywords", kw: ex });
    return out;
  }
  var hitCache = { key: "", defs: [] };
  function catHits(r) {
    var cats = categories(), key = cats.map(function (c) { return c.id + ":" + c.kw.length; }).join("|") + (load() || {}).extra;
    if (hitCache.key !== key) hitCache = { key: key, defs: cats.map(function (c) { return { id: c.id, res: c.kw.map(function (k) { return { k: k, re: new RegExp("\\b" + esc(k).replace(/\s+/g, "\\s+") + "(?:s|es)?\\b", "i") }; }) }; }) };
    if (r._ch && r._ch.k === key) return r._ch.m;
    var text = [r.title, r.plainTitle, r.scope, r.category].filter(Boolean).join(" \n "), m = {};
    hitCache.defs.forEach(function (d) { var hit = d.res.filter(function (x) { return x.re.test(text); }).map(function (x) { return x.k; }); if (hit.length) m[d.id] = hit; });
    r._ch = { k: key, m: m };
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
    ".wz-dd{position:relative;margin-top:14px}.wz-dd-btn{display:flex!important;justify-content:space-between;width:100%;text-align:left}" +
    ".wz-dd-list{position:absolute;left:0;right:0;top:100%;margin-top:4px;background:#fff;border:1px solid #b8c2cf;border-radius:6px;padding:6px 10px;max-height:300px;overflow:auto;box-shadow:0 4px 12px rgba(15,23,42,.15);z-index:5}" +
    ".wz-dd-tools{display:flex;gap:14px;padding:4px 2px}.wz .wz-dd-tools .link{margin:0;padding:2px 0}" +
    ".match-chip{display:inline-block;background:#e3f4ea;color:#1d7a46;border-radius:4px;padding:1px 6px;margin:0 6px 0 0;font-size:12px;font-weight:600;cursor:help}";
  document.head.appendChild(css);

  var back = null;
  function close() { if (back) { back.remove(); back = null; document.body.classList.remove("wz-open"); window.dispatchEvent(new Event("rfqwizardclose")); } }
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function open() {
    var cur = load() || {};
    var d = { cats: (cur.cats || CATS.map(function (c) { return c.id; })).slice(), extra: cur.extra || "",
      src: (cur.src || SOURCES.map(function (s) { return s.id; })).slice(), reg: Object.assign({}, cur.reg || {}) };
    close();
    back = document.createElement("div"); back.className = "wz-back";
    document.body.insertBefore(back, document.body.firstChild); document.body.classList.add("wz-open"); window.scrollTo(0, 0);

    var openDd = false;
    function label() { return d.cats.length ? d.cats.length + " of " + CATS.length + " selected" : "Nothing selected"; }
    function draw() {
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><h2>Which request categories would you like to see?</h2>" +
        "<p class='wz-note'>Pre-selected from discovergroup.net. Change them any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='toggle' aria-expanded='" + openDd + "'><span>" + label() + "</span><span>&#9662;</span></button>" +
        (openDd ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='all'>Select all</button><button type='button' class='link' data-a='none'>Clear</button></div>" +
          CATS.map(function (c) { return "<label class='wz-row'><input type='checkbox' data-cat='" + c.id + "'" + (d.cats.indexOf(c.id) >= 0 ? " checked" : "") + "> <span>" + h(c.label) + "</span></label>"; }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button class='pri' data-a='done'" + (d.cats.length ? "" : " disabled") + ">Next &rarr;</button></div></div>";
    }
    function collect() {
      var boxes = back.querySelectorAll("[data-cat]");
      if (boxes.length) { d.cats = []; Array.prototype.forEach.call(boxes, function (el) { if (el.checked) d.cats.push(el.dataset.cat); }); }
    }
    back.addEventListener("change", function (e) { if (e.target.dataset.cat) { collect(); var l = back.querySelector(".wz-dd-btn span"); l.textContent = label(); back.querySelector("[data-a=done]").disabled = !d.cats.length; } });
    back.addEventListener("click", function (e) {
      var a = e.target.closest("[data-a]"); if (!a) return;
      var act = a.dataset.a;
      collect();
      if (act === "toggle") openDd = !openDd;
      else if (act === "all") d.cats = CATS.map(function (c) { return c.id; });
      else if (act === "none") d.cats = [];
      else if (act === "done") {
        if (!d.cats.length) return;
        save({ cats: d.cats, extra: d.extra.trim(), src: d.src, reg: d.reg, saved: new Date().toISOString() });
        try { localStorage.removeItem(SKIP); } catch (x) {}
        close(); window.dispatchEvent(new Event("rfqprofilechange")); return;
      }
      draw();
    });
    draw();
  }

  // Which source a bid belongs to, plus its registration info and the vendor's saved status for it.
  function sourceFor(level, code) {
    return level === "Federal" ? "fed" : code === "TX" ? "tx" : code === "PA" ? "pa" : code === "NYC" ? "nyc" : "other";
  }
  function regInfo(id) {
    var p = load() || {}, s = SOURCES.filter(function (x) { return x.id === id; })[0];
    return s ? { id: id, label: s.label, reg: s.reg, url: s.url, steps: s.steps, registered: (p.reg || {})[id] === "yes" } : null;
  }
  function setReg(id, yes) {
    var p = load() || { cats: CATS.map(function (c) { return c.id; }), extra: "", src: ["fed", "tx", "pa", "nyc"], reg: {} };
    p.reg = p.reg || {}; if (yes) p.reg[id] = "yes"; else delete p.reg[id];
    save(p);
  }
  window.RFQProfile = { get: load, match: match, categories: categories, catHits: catHits, open: open, sourceFor: sourceFor, regInfo: regInfo, setReg: setReg };
  // First visit: offer the setup once. (Skipping is remembered; the toolbar button reopens it.)
  window.addEventListener("load", function () { if (!load()) open(); });
})();
