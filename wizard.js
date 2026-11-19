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

  // Bid value choices, shared with the main page's "Bid value" filter. [min, max] in dollars (null = open-ended).
  var VALUE_OPTS = [["under50", "Under $50K"], ["mid", "$50K to $500K"], ["over500", "Over $500K"], ["over1m", "Over $1M"], ["over5m", "Over $5M"],
    ["over10m", "Over $10M"], ["over50m", "Over $50M"], ["over100m", "Over $100M"], ["none", "No stated value"], ["custom", "Custom amount…"]];
  // Eligibility choices (step 4), shared with the main page's set-aside filter. nothing ticked = no restriction.
  var ASIDE_OPTS = [["open", "Open to all (no set-aside found)"], ["small", "Small business set-aside"], ["vet", "Veteran-owned (SDVOSB)"], ["women", "Women-owned (WOSB)"], ["other", "HUBZone, 8(a), minority-owned"]];
  var RANGES = { under50: [null, 49999.99], mid: [50000, 500000], over500: [500000.01, null], over1m: [1000000, null], over5m: [5000000, null], over10m: [10000000, null], over50m: [50000000, null], over100m: [100000000, null] };
  function num(x) { x = parseFloat(String(x == null ? "" : x).replace(/[$,\s]/g, "")); return isFinite(x) && x >= 0 ? x : null; }
  // Does a bid with value v (number or null) pass the filter f = { value, vmin, vmax }?
  function valueOk(f, v) {
    var ks = toArr(f && f.value);
    if (!ks.length) return true;
    for (var i = 0; i < ks.length; i++) if (oneValueOk(ks[i], f, v)) return true; // any ticked range matches
    return false;
  }
  // Saved choices are lists; older saves held one string ("any" = nothing ticked).
  function toArr(x) { return Array.isArray(x) ? x.slice() : x && x !== "any" ? [x] : []; }
  function oneValueOk(k, f, v) {
    if (k === "none") return v == null;
    var lo, hi;
    if (k === "custom") { lo = num(f.vmin); hi = num(f.vmax); if (lo == null && hi == null) return true; }
    else { var r = RANGES[k]; if (!r) return true; lo = r[0]; hi = r[1]; }
    return v != null && (lo == null || v >= lo) && (hi == null || v <= hi);
  }
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
    ".wz .wz-step{margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b}" +
    ".wz .wz-note{color:#64748b;font-size:13px}.wz .wz-sum{list-style:none;padding:0}.wz .wz-sum li{margin:8px 0;padding:10px 14px;border-radius:6px;background:#f7f9fb;border:1px solid #e5e9f0}" +
    ".wz a{color:#1e3a5f;font-weight:600}" +
    ".wz-dd{position:relative;margin-top:14px}.wz-dd-btn{display:flex!important;justify-content:space-between;width:100%;text-align:left}" +
    ".wz-dd:has(.wz-dd-list){margin-bottom:320px}.wz-cust{display:flex;gap:12px;margin-top:10px}.wz-cust[hidden]{display:none}.wz-cust label{flex:1;font-size:13px;color:#64748b}.wz-cust input{width:100%;font:inherit;padding:8px 10px;border:1px solid #b8c2cf;border-radius:6px;margin-top:3px;color:#1f2937}.wz-sel{width:100%;font:inherit;padding:9px 11px;border:1px solid #b8c2cf;border-radius:6px;background:#fff;color:#1f2937}" +
    ".wz-dd-list{position:absolute;left:0;right:0;top:100%;margin-top:4px;background:#fff;border:1px solid #b8c2cf;border-radius:6px;padding:6px 10px;max-height:300px;overflow:auto;box-shadow:0 4px 12px rgba(15,23,42,.15);z-index:5}" +
    ".wz-gh{display:flex;align-items:center;gap:8px;margin:2px 0;padding:5px 2px;border-bottom:1px solid #eef1f5}.wz-gt{flex:1;cursor:pointer;font-weight:600;font-size:14px;color:#1f2937}.wz-gt em{font-style:normal;font-weight:400;font-size:12px;color:#64748b;margin-left:6px}.wz-arr{display:inline-block;width:14px;color:#64748b}.wz-kids{padding:2px 0 6px 24px}" +
    ".wz-grp{position:sticky;top:-6px;background:#fff;margin:8px 0 2px;padding:4px 2px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b}" +
    ".wz-spin{width:34px;height:34px;margin:6px auto 14px;border:4px solid #e5e9f0;border-top-color:#1e3a5f;border-radius:50%;animation:wzspin .8s linear infinite}@keyframes wzspin{to{transform:rotate(360deg)}}" +
    ".wz-dd-tools{display:flex;gap:14px;padding:4px 2px}.wz .wz-dd-tools .link{margin:0;padding:2px 0}" +
    ".match-chip{display:inline-block;background:#e3f4ea;color:#1d7a46;border-radius:4px;padding:1px 6px;margin:0 6px 0 0;font-size:12px;font-weight:600;cursor:help}";
  document.head.appendChild(css);

  var back = null;
  var onPop = null, pushed = 0; // browser Back walks the wizard steps, then closes it
  function unhook() { if (onPop) { window.removeEventListener("popstate", onPop); onPop = null; } }
  function close() { unhook(); if (back) { back.remove(); back = null; document.body.classList.remove("wz-open"); window.dispatchEvent(new Event("rfqwizardclose")); } }
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function open() {
    var cur = load() || {};
    var d = { cats: (cur.cats || CATS.map(function (c) { return c.id; })).slice(), extra: cur.extra || "",
      src: (cur.src || SOURCES.map(function (s) { return s.id; })).slice(), reg: Object.assign({}, cur.reg || {}), value: toArr(cur.value), aside: toArr(cur.aside), vmin: cur.vmin || "", vmax: cur.vmax || "" };
    close();
    back = document.createElement("div"); back.className = "wz-back";
    document.body.insertBefore(back, document.body.firstChild); document.body.classList.add("wz-open"); window.scrollTo(0, 0);

    var openDd = false;
    // Every category: the product types (pre-selected) plus every category the bids themselves carry (not pre-selected).
    var ALL = [];
    function loadAll() {
      ALL = CATS.map(function (c) { return { v: c.id, label: c.label, group: "My products" }; });
      // Bid categories come in their own groups, collapsed by default so the long list stays usable.
      try { ALL = ALL.concat((window.RFQExtraCats ? window.RFQExtraCats() : []).map(function (o) { return { v: o.v, label: o.label, group: o.group }; })); } catch (e) {}
    }
    loadAll();
    function label() { return d.cats.length ? d.cats.length + " of " + ALL.length + " selected" : "Nothing selected"; }
    // Collapsible groups: a group checkbox ticks every category inside it; the arrow expands it. My products start open.
    var openG = { "My products": true };
    function groups() {
      var gs = [], idx = {};
      ALL.forEach(function (c) { if (!(c.group in idx)) { idx[c.group] = gs.length; gs.push({ name: c.group, items: [] }); } gs[idx[c.group]].items.push(c); });
      return gs;
    }
    function listHtml() {
      return groups().map(function (g, i) {
        var n = g.items.filter(function (c) { return d.cats.indexOf(c.v) >= 0; }).length, op = !!openG[g.name];
        return "<div class='wz-gh' data-gi='" + i + "'><input type='checkbox' data-grp='" + i + "' aria-label='Select all in " + h(g.name) + "'" + (n === g.items.length ? " checked" : "") + ">" +
          "<div class='wz-gt' data-g='" + i + "' role='button' aria-expanded='" + op + "'><span class='wz-arr'>" + (op ? "&#9662;" : "&#9656;") + "</span> " + h(g.name) + " <em>" + n + "/" + g.items.length + "</em></div></div>" +
          "<div class='wz-kids' data-kids='" + i + "'" + (op ? "" : " hidden") + ">" + g.items.map(function (c) {
            return "<label class='wz-row'><input type='checkbox' data-cat='" + h(c.v) + "'" + (d.cats.indexOf(c.v) >= 0 ? " checked" : "") + "> <span>" + h(c.label) + "</span></label>";
          }).join("") + "</div>";
      }).join("");
    }
    // Refresh group tick boxes / counts and the button label without redrawing (keeps the scroll position).
    function sync() {
      var l = back.querySelector(".wz-dd-btn span"); if (l) l.textContent = label();
      var done = back.querySelector("[data-a=done]"); if (done) done.disabled = !d.cats.length;
      groups().forEach(function (g, i) {
        var n = g.items.filter(function (c) { return d.cats.indexOf(c.v) >= 0; }).length;
        var gb = back.querySelector("[data-grp='" + i + "']"); if (!gb) return;
        gb.checked = n === g.items.length; gb.indeterminate = n > 0 && n < g.items.length;
        gb.parentNode.querySelector("em").textContent = n + "/" + g.items.length;
      });
    }
    // Step 2: which jurisdictions. Everything is ticked by default; all ticked is saved as "no restriction".
    var step = 1, J = [];
    function loadJ() { try { J = window.RFQJurisdictions ? window.RFQJurisdictions() : []; } catch (e) { J = []; } }
    var openJ = false;
    function jLabel() { return d.where.length ? d.where.length + " of " + J.length + " selected" : "Nothing selected"; }
    function drawJ() {
      if (!openJ) loadJ();
      if (!d.where) d.where = (cur.where && cur.where.length ? cur.where : J.map(function (o) { return o.v; })).slice();
      var gs = [], idx = {};
      J.forEach(function (o) { if (!(o.group in idx)) { idx[o.group] = gs.length; gs.push({ name: o.group, items: [] }); } gs[idx[o.group]].items.push(o); });
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 2</p><h2>Which jurisdiction would you like to see?</h2>" +
        "<p class='wz-note'>Federal, city and state bids. Change them any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='jtoggle' aria-expanded='" + openJ + "'><span>" + jLabel() + "</span><span>&#9662;</span></button>" +
        (openJ ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='jall'>Select all</button><button type='button' class='link' data-a='jnone'>Clear</button></div>" +
          gs.map(function (g) {
            return "<div class='wz-grp'>" + h(g.name) + "</div>" + g.items.map(function (o) {
              return "<label class='wz-row'><input type='checkbox' data-jur='" + h(o.v) + "'" + (d.where.indexOf(o.v) >= 0 ? " checked" : "") + "> <span>" + h(o.label) + " <em class='wz-note'>(" + o.n + ")</em></span></label>";
            }).join("");
          }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button data-a='back'>&larr; Back</button><button class='pri' data-a='next3'" + (d.where.length ? "" : " disabled") + ">Next &rarr;</button></div></div>";
    }
    // Step 3: which bid value. Stored as the same keys the main page's "Bid value" filter uses ("any" = no restriction).
    var openV = false;
    function multiLabel(opts, sel, none) { var o = opts.filter(function (x) { return sel.indexOf(x[0]) >= 0; }); return !o.length ? none : o.length === 1 ? o[0][1] : o.length + " selected"; }
    function vLabel() { return multiLabel(VALUE_OPTS, d.value, "Any value"); }
    function drawV() {
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 3</p><h2>Which value would you like to see?</h2>" +
        "<p class='wz-note'>Many bids do not state a value; choosing a range hides those. Change it any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='vtoggle' aria-expanded='" + openV + "'><span>" + h(vLabel()) + "</span><span>&#9662;</span></button>" +
        (openV ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='vall'>Select all</button><button type='button' class='link' data-a='vnone'>Clear</button></div>" + VALUE_OPTS.map(function (o) {
          return "<label class='wz-row'><input type='checkbox' data-vpick='" + h(o[0]) + "'" + (d.value.indexOf(o[0]) >= 0 ? " checked" : "") + "> <span>" + h(o[1]) + "</span></label>";
        }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-cust' data-cust" + (d.value.indexOf("custom") >= 0 ? "" : " hidden") + "><label>From $ <input type='text' inputmode='numeric' data-vmin placeholder='no minimum' value='" + h(d.vmin) + "'></label>" +
        "<label>To $ <input type='text' inputmode='numeric' data-vmax placeholder='no maximum' value='" + h(d.vmax) + "'></label></div>" +
        "<div class='wz-btns'><button data-a='back3'>&larr; Back</button><button class='pri' data-a='next4'>Next &rarr;</button></div></div>";
    }
    // Step 4: which eligibility would you like to see? Which set-aside / eligibility group the vendor belongs to.
    var openA = false;
    function aLabel() { return multiLabel(ASIDE_OPTS, d.aside, "Anyone"); }
    function drawA() {
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 4</p><h2>Which eligibility criteria would you like to see?</h2>" +
        "<p class='wz-note'>Some bids are reserved for certain businesses. Pick the eligibility you want to see. Change it any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='atoggle' aria-expanded='" + openA + "'><span>" + h(aLabel()) + "</span><span>&#9662;</span></button>" +
        (openA ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='aall'>Select all</button><button type='button' class='link' data-a='anone'>Clear</button></div>" + ASIDE_OPTS.map(function (o) {
          return "<label class='wz-row'><input type='checkbox' data-apick='" + h(o[0]) + "'" + (d.aside.indexOf(o[0]) >= 0 ? " checked" : "") + "> <span>" + h(o[1]) + "</span></label>";
        }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button data-a='back4'>&larr; Back</button><button class='pri' data-a='finish'>Show me my RFQs</button></div></div>";
    }
    function collectJ() {
      var boxes = back.querySelectorAll("[data-jur]");
      if (boxes.length) { d.where = []; Array.prototype.forEach.call(boxes, function (el) { if (el.checked) d.where.push(el.dataset.jur); }); }
    }
    function draw() {
      if (step === 4) return drawA();
      if (step === 3) return drawV();
      if (step === 2) return drawJ();
      if (!openDd) loadAll(); // pick up bid categories that arrived after the page loaded (live data)
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 1</p><h2>Which request categories would you like to see?</h2>" +
        "<p class='wz-note'>Pre-selected from discovergroup.net. Change them any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='toggle' aria-expanded='" + openDd + "'><span>" + label() + "</span><span>&#9662;</span></button>" +
        (openDd ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='all'>Select all</button><button type='button' class='link' data-a='none'>Clear</button></div>" +
          listHtml() + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button class='pri' data-a='done'" + (d.cats.length ? "" : " disabled") + ">Next &rarr;</button></div></div>";
    }
    function collect() {
      var boxes = back.querySelectorAll("[data-cat]");
      if (boxes.length) { d.cats = []; Array.prototype.forEach.call(boxes, function (el) { if (el.checked) d.cats.push(el.dataset.cat); }); }
    }
    back.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.grp != null) {
        Array.prototype.forEach.call(back.querySelectorAll("[data-kids='" + t.dataset.grp + "'] [data-cat]"), function (el) { el.checked = t.checked; });
        collect(); sync();
      } else if (t.dataset.cat) { collect(); sync(); }
      else if (t.dataset.vpick != null) {
        d.value = Array.prototype.map.call(back.querySelectorAll("[data-vpick]:checked"), function (el) { return el.dataset.vpick; });
        var vb = back.querySelector(".wz-dd-btn span"); if (vb) vb.textContent = vLabel();
        var vc = back.querySelector("[data-cust]"); if (vc) vc.hidden = d.value.indexOf("custom") < 0;
      }
      else if (t.dataset.apick != null) {
        d.aside = Array.prototype.map.call(back.querySelectorAll("[data-apick]:checked"), function (el) { return el.dataset.apick; });
        var ab = back.querySelector(".wz-dd-btn span"); if (ab) ab.textContent = aLabel();
      }
      else if (t.dataset.jur) { collectJ(); var f = back.querySelector("[data-a=finish]"); if (f) f.disabled = !d.where.length; var jl = back.querySelector(".wz-dd-btn span"); if (jl) jl.textContent = jLabel(); }
    });
    back.addEventListener("input", function (e) { var t = e.target; if (t.dataset.vmin != null) d.vmin = t.value; else if (t.dataset.vmax != null) d.vmax = t.value; });
    back.addEventListener("click", function (e) {
      var g = e.target.closest("[data-g]"); if (!g) return;
      var gr = groups()[+g.dataset.g], kids = back.querySelector("[data-kids='" + g.dataset.g + "']");
      openG[gr.name] = kids.hidden; kids.hidden = !kids.hidden;
      g.setAttribute("aria-expanded", String(!kids.hidden)); g.querySelector(".wz-arr").innerHTML = kids.hidden ? "&#9656;" : "&#9662;";
    });
    try { history.pushState({ wz: 1 }, ""); pushed = 1; } catch (x) { pushed = 0; }
    onPop = function (ev) {
      var s = ev.state && ev.state.wz;
      if (!s) { close(); return; } // Back past step 1: leave the wizard
      if (step === 2) collectJ(); else if (step === 1) collect();
      step = s; openJ = openV = openA = false; draw();
    };
    window.addEventListener("popstate", onPop);
    back.addEventListener("click", function (e) {
      var a = e.target.closest("[data-a]"); if (!a) return;
      var act = a.dataset.a;
      if (step === 2) collectJ(); else if (step === 1) collect();
      if (pushed && (act === "back" || act === "back3" || act === "back4")) { history.back(); return; }
      var before = step;
      if (act === "toggle") openDd = !openDd;
      else if (act === "all") d.cats = ALL.map(function (c) { return c.v; });
      else if (act === "none") d.cats = [];
      else if (act === "jtoggle") openJ = !openJ;
      else if (act === "vtoggle") openV = !openV;
      else if (act === "atoggle") openA = !openA;
      else if (act === "vall") d.value = VALUE_OPTS.map(function (o) { return o[0]; }).filter(function (k) { return k !== "custom"; });
      else if (act === "vnone") d.value = [];
      else if (act === "aall") d.aside = ASIDE_OPTS.map(function (o) { return o[0]; });
      else if (act === "anone") d.aside = [];
      else if (act === "next4") { step = 4; openA = false; }
      else if (act === "back4") { step = 3; openV = false; }
      else if (act === "jall") d.where = J.map(function (o) { return o.v; });
      else if (act === "jnone") d.where = [];
      else if (act === "back") { step = 1; openJ = false; }
      else if (act === "back3") { step = 2; openJ = false; }
      else if (act === "next3") { if (!d.where.length) return; step = 3; openV = false; }
      else if (act === "done") {
        if (!d.cats.length) return;
        step = 2; openJ = false;
      }
      else if (act === "finish") {
        if (!d.where.length) return;
        var every = J.length && J.every(function (o) { return d.where.indexOf(o.v) >= 0; });
        save({ cats: d.cats, where: every ? [] : d.where, value: d.value, aside: d.aside, vmin: d.vmin, vmax: d.vmax, extra: d.extra.trim(), src: d.src, reg: d.reg, saved: new Date().toISOString() });
        try { localStorage.removeItem(SKIP); } catch (x) {}
        // Show a "working" message, let it paint, then do the (possibly slow) list compile.
        back.innerHTML = "<div class='wz' role='status' aria-live='polite' style='text-align:center'><div class='wz-spin'></div><h2>Compiling your RFQ list&hellip;</h2><p class='wz-note'>Matching bids to your choices. This can take a moment.</p></div>";
        unhook(); if (pushed) { var n = pushed; pushed = 0; history.go(-n); } // drop the wizard's history entries
        setTimeout(function () { close(); window.dispatchEvent(new Event("rfqprofilechange")); }, 60);
        return;
      }
      if (pushed && step > before) { try { history.pushState({ wz: step }, ""); pushed++; } catch (x) {} }
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
  window.RFQProfile = { get: load, match: match, categories: categories, catHits: catHits, open: open, sourceFor: sourceFor, regInfo: regInfo, setReg: setReg, valueOpts: VALUE_OPTS, asideOpts: ASIDE_OPTS, valueOk: valueOk };
  // First visit: offer the setup once. (Skipping is remembered; the toolbar button reopens it.)
  // Opened immediately (not on window "load") so the main page never paints before the wizard hides it.
  // The bid-category list comes from home.js, which loads after this file, so wait until every script has run.
  // Every page load or refresh starts at wizard step 1 — except the page's own reload right after a data refresh.
  var autoReload = false;
  try { autoReload = !!sessionStorage.getItem("rfqAutoReload"); } catch (e) {}
  if (!autoReload) {
    document.body.classList.add("wz-open");
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", open); else open();
  }
})();
