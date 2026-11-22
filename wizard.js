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
    { id: "fed", label: "SAM.gov (Federal)", reg: "entity registration",
      url: "https://sam.gov/content/entity-registration",
      steps: ["Get a free Unique Entity ID at SAM.gov (needs the legal business name and address).", "Complete the entity registration (NAICS codes, tax details, bank details for payment).", "Wait for approval; this can take a couple of weeks, so start early."] },
    { id: "tx", label: "Texas CMBL / ESBD (Texas)", reg: "Centralized Master Bidders List",
      url: "https://comptroller.texas.gov/purchasing/vendor/cmbl/",
      steps: ["Register on the Texas Comptroller's Centralized Master Bidders List.", "Pick the product classes (commodity codes) you sell so you are notified of matching bids.", "Bids themselves are posted on the Texas ESBD (txsmartbuy.gov/esbd)."] },
    { id: "pa", label: "PA eMarketplace (Pennsylvania)", reg: "supplier account",
      url: "https://www.emarketplace.state.pa.us/",
      steps: ["Create a supplier account on the PA eMarketplace.", "Add your commodity codes and contact details.", "Check each bid for any extra vendor requirements."] },
    { id: "nyc", label: "NYC PASSPort (New York City)", reg: "vendor account",
      url: "https://www.nyc.gov/site/mocs/passport/about-passport.page",
      steps: ["Create a PASSPort account for your company.", "Complete the vendor profile (ownership, tax, and so on).", "Add the commodity categories you sell so you can respond to solicitations."] },
  ];
  // One entry per state portal the tracker reads: [bid-feed code, portal, jurisdiction].
  [["AK", "Alaska IRIS VSS", "Alaska"], ["AR", "Arkansas Procurement", "Arkansas"], ["CO", "Colorado VSS", "Colorado"], ["DE", "Delaware Bids", "Delaware"],
   ["FL", "MyFloridaMarketPlace", "Florida"], ["HI", "HANDS", "Hawaii"], ["ID", "Idaho Purchasing", "Idaho"], ["IL", "BidBuy", "Illinois"],
   ["IN", "IDOA Procurement", "Indiana"], ["IA", "Iowa Bid Opportunities", "Iowa"], ["KS", "Kansas eSupplier", "Kansas"], ["LA", "LaPAC", "Louisiana"],
   ["MA", "COMMBUYS", "Massachusetts"], ["MS", "Mississippi Bid Search", "Mississippi"], ["MO", "MissouriBUYS", "Missouri"], ["NE", "Nebraska DAS Bids", "Nebraska"],
   ["NV", "NevadaEPro", "Nevada"], ["NJ", "NJSTART", "New Jersey"], ["NY", "NY State Contract Reporter", "New York State"], ["OK", "Oklahoma Supplier Portal", "Oklahoma"],
   ["OR", "OregonBuys", "Oregon"], ["RI", "Rhode Island Purchasing", "Rhode Island"], ["SC", "SCEIS Solicitations", "South Carolina"],
   ["SD", "SD Posting Board", "South Dakota"], ["TXDOT", "TxDOT Lettings", "Texas"], ["VT", "Vermont Bid Opportunities", "Vermont"],
   ["WV", "wvOASIS", "West Virginia"], ["WY", "Wyoming Public Purchase", "Wyoming"]
  ].forEach(function (x) { SOURCES.push({ id: x[0].toLowerCase(), label: x[1] + " (" + x[2] + ")", reg: "", url: "", steps: ["Open a bid from this portal and follow its own registration link."] }); });

  // Bid value choices, shared with the main page's "Bid value" filter. [min, max] in dollars (null = open-ended).
  var VALUE_OPTS = [["under50", "Under $50K"], ["mid", "$50K to $500K"], ["over500", "Over $500K"], ["over5m", "Over $5M"],
    ["none", "No stated value"], ["custom", "Custom amount…"]];
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
  function load() { try { var p = JSON.parse(localStorage.getItem(KEY)); if (!p || typeof p !== "object") return null; if (Array.isArray(p.reg)) p.reg = migrateReg(p.reg); return p; } catch (e) { return null; } }
  // Older saved profiles ticked one lumped "other" entry; expand it to every state portal.
  function migrateReg(reg) {
    if (reg.indexOf("other") < 0) return reg.slice();
    var base = { fed: 1, tx: 1, pa: 1, nyc: 1 };
    return reg.filter(function (r) { return r !== "other"; }).concat(SOURCES.map(function (x) { return x.id; }).filter(function (i) { return !base[i] && reg.indexOf(i) < 0; }));
  }
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
  // The profile is only re-parsed when its stored text changes (a raw getItem is cheap; JSON.parse per notice per category was not).
  var hitCache = { raw: undefined, key: "", defs: [] };
  function catHits(r) {
    var raw; try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (hitCache.raw !== raw) {
      var cats = categories(), key = cats.map(function (c) { return c.id + ":" + c.kw.length; }).join("|") + (load() || {}).extra;
      hitCache = { raw: raw, key: key, defs: cats.map(function (c) { return { id: c.id, res: c.kw.map(function (k) { return { k: k, re: new RegExp("\\b" + esc(k).replace(/\s+/g, "\\s+") + "(?:s|es)?\\b", "i") }; }) }; }) };
    }
    var key = hitCache.key;
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
    ".wz-back{min-height:100vh;background:#f1f4f8;display:flex;align-items:flex-start;justify-content:center;padding:20px;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}" +
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
    ".wz-dd:has(.wz-dd-list){margin-bottom:calc(85vh + 12px)}.wz-cust{display:flex;gap:12px;margin-top:10px}.wz-cust[hidden]{display:none}.wz-cust label{flex:1;font-size:13px;color:#64748b}.wz-cust input{width:100%;font:inherit;padding:8px 10px;border:1px solid #b8c2cf;border-radius:6px;margin-top:3px;color:#1f2937}.wz-sel{width:100%;font:inherit;padding:9px 11px;border:1px solid #b8c2cf;border-radius:6px;background:#fff;color:#1f2937}" +
    ".wz-dd-list{position:absolute;left:0;right:0;top:100%;margin-top:4px;background:#fff;border:1px solid #b8c2cf;border-radius:6px;padding:6px 10px;max-height:85vh;overflow:auto;box-shadow:0 4px 12px rgba(15,23,42,.15);z-index:5}" +
    ".wz-gh{display:flex;align-items:center;gap:8px;margin:2px 0;padding:5px 2px;border-bottom:1px solid #eef1f5}.wz-gt{flex:1;cursor:pointer;font-weight:600;font-size:14px;color:#1f2937}.wz-gt em{font-style:normal;font-weight:400;font-size:12px;color:#64748b;margin-left:6px}.wz-arr{display:inline-block;width:14px;color:#64748b}.wz-kids{padding:2px 0 6px 24px}" +
    ".wz-grp{position:sticky;top:-6px;background:#fff;margin:8px 0 2px;padding:4px 2px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b}" +
    ".wz-spin{width:34px;height:34px;margin:6px auto 14px;border:4px solid #e5e9f0;border-top-color:#1e3a5f;border-radius:50%;animation:wzspin .8s linear infinite}@keyframes wzspin{to{transform:rotate(360deg)}}" +
    ".wz-dd-tools{display:flex;gap:14px;padding:4px 2px}.wz .wz-dd-tools .link{margin:0;padding:2px 0}" +
    ".wz-back{gap:20px;flex-wrap:wrap;align-items:stretch}.wz-back>.wz{flex:0 1 660px;width:auto;min-width:0}" +
    ".wz-side{flex:0 0 185px;box-sizing:border-box;contain:size;display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#1f2937;border:1px solid #d9dfe7;border-radius:8px;padding:6px 8px;box-shadow:0 1px 3px rgba(15,23,42,.08);font-size:12px}" +
    ".wz-side summary{cursor:pointer;font-size:12px;font-weight:600;color:#0f2742;padding:4px 0;list-style:none}.wz-side summary::-webkit-details-marker{display:none}.wz-side summary:before{content:'\\25B8';display:inline-block;width:12px;color:#64748b}.wz-side details[open]>summary:before{content:'\\25BE'}" +
    ".wz-side-sec{padding:3px 6px;margin:0 -2px;border-left:2px solid transparent;border-radius:3px;font-size:12px}.wz-side-sec.cur{background:#f0f4f9;border-left-color:#1e3a5f}" +
    ".wz-side-sec>summary{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;padding:1px 0}.wz-side-sec>summary b{color:#1f2937;letter-spacing:0;text-transform:none;font-weight:600}" +
    ".wz-side ul{margin:2px 0 0;padding-left:14px}.wz-side li{margin:0;line-height:1.3}.wz-side-more{list-style:none;margin-left:-14px!important;color:#64748b}.wz-side-none{color:#64748b;font-style:italic}" +
    ".wz-sel-box{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}.wz-side-sel{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;overflow-wrap:anywhere;margin-bottom:2px}.wz-side-sel *{max-width:100%;box-sizing:border-box}" +
    ".wz-side-sec>ul{max-height:7.8em;overflow-y:auto;overflow-x:hidden;padding-right:4px}" +
    ".wz-side-sel::-webkit-scrollbar,.wz-side-sec>ul::-webkit-scrollbar{width:10px}.wz-side-sel::-webkit-scrollbar-track,.wz-side-sec>ul::-webkit-scrollbar-track{background:#e5e9f0;border-radius:5px}.wz-side-sel::-webkit-scrollbar-thumb,.wz-side-sec>ul::-webkit-scrollbar-thumb{background:#8795a8;border-radius:5px;border:2px solid #e5e9f0}" +
    "@supports(-moz-appearance:none){.wz-side-sel,.wz-side-sec>ul{scrollbar-width:auto;scrollbar-color:#8795a8 #e5e9f0}}" +
    ".bt-fab{position:fixed;right:22px;bottom:200px;z-index:20;display:flex;align-items:center;gap:8px;padding:10px 18px 10px 12px;border:0;border-radius:999px;background:#1e3a5f;color:#fff;font:600 14px system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(15,39,66,.35)}.bt-fab:hover{background:#16304f}.bt-fab svg{width:30px;height:30px;flex:none}" +
    ".bt-panel{position:fixed;right:22px;bottom:200px;z-index:21;width:360px;max-width:calc(100vw - 24px);max-height:calc(100vh - 102px);display:flex;flex-direction:column;background:#fff;color:#1f2937;border:1px solid #b8c2cf;border-radius:12px;box-shadow:0 8px 28px rgba(15,23,42,.28);font:14px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;overflow:hidden}" +
    ".bt-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1e3a5f;color:#fff;font-weight:600}.bt-head svg{width:30px;height:30px;flex:none}.bt-head span{flex:1}.bt-head button{border:0;background:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}" +
    ".bt-log{flex:1 1 auto;min-height:120px;overflow:auto;padding:8px 12px}.bt-form{padding:10px 12px;border-top:1px solid #e5e9f0;background:#f7f9fb}.bt-form label{display:block;font-size:12px;font-weight:600;color:#64748b;margin:0 0 3px}" +
    ".bt-row{display:flex;gap:6px;margin-bottom:8px}.bt-row input,.bt-form textarea{flex:1;min-width:0;font:inherit;padding:7px 9px;border:1px solid #c5cdd8;border-radius:6px;box-sizing:border-box}.bt-form textarea{width:100%;resize:vertical;margin-bottom:6px}.bt-row input:focus,.bt-form textarea:focus{outline:2px solid #1e3a5f33;border-color:#1e3a5f}" +
    ".bt-form button{font:inherit;font-size:13px;font-weight:500;padding:7px 12px;border-radius:6px;border:1px solid #b8c2cf;background:#fff;color:#1f2937;cursor:pointer}.bt-form button.pri{background:#1e3a5f;border-color:#1e3a5f;color:#fff}.bt-form button:disabled{opacity:.5;cursor:default}.bt-go{width:100%}" +
    ".wz-msg{background:#f0f4f9;border-radius:6px;padding:8px 10px;margin:6px 28px 6px 0;font-size:13px}.wz-msg.me{background:#1e3a5f;color:#fff;margin:6px 0 6px 28px}.wz-msg .pri{margin-top:6px;padding:4px 12px;font-size:13px}.wz-msg .wz-note{font-size:12px}" +
    "@media(max-width:900px){.wz-side{flex:1 1 660px;contain:none;max-height:420px}}" +
    ".match-chip{display:inline-block;background:#e3f4ea;color:#1d7a46;border-radius:4px;padding:1px 6px;margin:0 6px 0 0;font-size:12px;font-weight:600;cursor:help}";
  document.head.appendChild(css);

  var back = null;
  var onPop = null, pushed = 0; // browser Back walks the wizard steps, then closes it
  function unhook() { if (onPop) { window.removeEventListener("popstate", onPop); onPop = null; } }
  function close() { unhook(); wzClear(); if (back) { back.remove(); back = null; document.body.classList.remove("wz-open"); window.dispatchEvent(new Event("rfqwizardclose")); } }
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var WZKEY = "rfqWzState";
  function wzClear() { try { sessionStorage.removeItem(WZKEY); } catch (e) {} }
  function open(restore) {
    var saved = null;
    if (restore === true) { try { saved = JSON.parse(sessionStorage.getItem(WZKEY) || "null"); } catch (e) {} }
    var cur = load() || {};
    // Only real bid categories ("c:..." ids) are listed. Older saves held the retired "My products" ids; those, or no save at all,
    // mean "start from the categories that apply to Discover Group".
    var oldCats = cur.cats || [], pend = !cur.catsV || oldCats.some(function (i) { return String(i).slice(0, 2) !== "c:"; }); // only saves from before catsV (or none) start from the defaults; a newer save, even an empty "all categories" one, is kept as it was
    var d = { cats: oldCats.filter(function (i) { return String(i).slice(0, 2) === "c:"; }), extra: cur.extra || "",
      src: (cur.src || SOURCES.map(function (s) { return s.id; })).slice(), reg: migrateReg(cur.reg || []), value: toArr(cur.value), aside: toArr(cur.aside), vmin: cur.vmin || "", vmax: cur.vmax || "" };
    close();
    back = document.createElement("div"); back.className = "wz-back";
    document.body.insertBefore(back, document.body.firstChild); document.body.classList.add("wz-open"); window.scrollTo(0, 0);

    var openDd = false;
    // Every category: the product types (pre-selected) plus every category the bids themselves carry (not pre-selected).
    var ALL = [], openG = {};
    // Does a category apply to Discover Group? Its title mentions something Discover sells, or it sits in a goods group it sells from.
    // Discover sells goods, not services, so service-type categories are left unticked.
    var DG_GROUPS = ["Goods - Electronics & electrical", "Goods - Wholesale & supplies"];
    var DG_RES = null;
    function applies(o) {
      if (!DG_RES) DG_RES = CATS.reduce(function (a, c) { return a.concat(c.kw); }, []).map(function (k) { return new RegExp("\\b" + esc(k).replace(/\s+/g, "\\s+") + "(?:s|es)?\\b", "i"); });
      if (/\bserv(ice|ices)\b|\bsvcs\b|maintenance|leased space|surgical|\bvans?\b|minivan/i.test(o.label) && !/suppl|equipment|product|manufactur/i.test(o.label)) return false;
      return DG_GROUPS.indexOf(o.group) >= 0 || DG_RES.some(function (re) { return re.test(o.label); });
    }
    function loadAll() {
      // Every bid category, in its own group; groups start collapsed so the long list stays usable.
      try { ALL = (window.RFQExtraCats ? window.RFQExtraCats() : []).map(function (o) { return { v: o.v, label: o.label, group: o.group }; }); } catch (e) { ALL = []; }
      if (pend && ALL.length) { // first time the list is known: tick what applies to Discover Group and open those groups
        ALL.forEach(function (o) { if (applies(o)) { if (d.cats.indexOf(o.v) < 0) d.cats.push(o.v); openG[o.group] = true; } });
        pend = false;
      }
    }
    loadAll();
    function label() { return d.cats.length ? d.cats.length + " of " + ALL.length + " selected" : "All categories"; }
    // Collapsible groups: a group checkbox ticks every category inside it; the arrow expands it.
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
      
      groups().forEach(function (g, i) {
        var n = g.items.filter(function (c) { return d.cats.indexOf(c.v) >= 0; }).length;
        var gb = back.querySelector("[data-grp='" + i + "']"); if (!gb) return;
        gb.checked = n === g.items.length; gb.indeterminate = n > 0 && n < g.items.length;
        gb.parentNode.querySelector("em").textContent = n + "/" + g.items.length;
      });
    }
    // Step 2: which jurisdictions. Everything is ticked by default; all ticked is saved as "no restriction".
    var step = 1, J = [];
    if (saved && saved.step >= 1 && saved.step <= 4 && saved.d) { Object.keys(saved.d).forEach(function (k) { d[k] = saved.d[k]; }); step = saved.step; pend = false; }
    function loadJ() { try { J = window.RFQJurisdictions ? window.RFQJurisdictions() : []; } catch (e) { J = []; } }
    var openJ = false;
    function jLabel() { return d.where.length ? d.where.length + " of " + J.length + " selected" : "All locations"; }
    function drawJ() {
      if (!openJ) loadJ();
      if (!d.where) d.where = (cur.where || []).slice();
      var gs = [], idx = {};
      J.forEach(function (o) { if (!(o.group in idx)) { idx[o.group] = gs.length; gs.push({ name: o.group, items: [] }); } gs[idx[o.group]].items.push(o); });
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 3</p><h2>Which jurisdiction would you like to see?</h2>" +
        "<p class='wz-note'>Federal, city and state bids. Change them any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='jtoggle' aria-expanded='" + openJ + "'><span>" + jLabel() + "</span><span>&#9662;</span></button>" +
        (openJ ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='jnone'>" + ((J.length && d.where.length >= J.length) ? "Clear all" : "Select all") + "</button>" +
          [["City", "cities", "jcity"], ["States", "states", "jstate"]].map(function (x) {
            var v = J.filter(function (o) { return o.group === x[0]; });
            return v.length ? "<button type='button' class='link' data-a='" + x[2] + "'>" + (v.every(function (o) { return d.where.indexOf(o.v) >= 0; }) ? "Clear " : "Select ") + "all " + x[1] + "</button>" : "";
          }).join("") + "</div>" +
          gs.map(function (g) {
            return "<div class='wz-grp'>" + h(g.name) + "</div>" + g.items.map(function (o) {
              return "<label class='wz-row'><input type='checkbox' data-jur='" + h(o.v) + "'" + (d.where.indexOf(o.v) >= 0 ? " checked" : "") + "> <span>" + h(o.label) + " <em class='wz-note'>(" + o.n + ")</em></span></label>";
            }).join("");
          }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button data-a='prev'>&larr; Back</button><button class='pri' data-a='next'>Next &rarr;</button></div></div>";
    }
    // Step 4: which eligibility would you like to see? Which set-aside / eligibility group the vendor belongs to.
    var openA = false;
    function multiLabel(opts, sel, none) { var o = opts.filter(function (x) { return sel.indexOf(x[0]) >= 0; }); return !o.length ? none : o.length === 1 ? o[0][1] : o.length + " selected"; }
    function aLabel() { return multiLabel(ASIDE_OPTS, d.aside, "Anyone"); }
    function drawA() {
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 4</p><h2>Which eligibility criteria would you like to see?</h2>" +
        "<p class='wz-note'>Some bids are reserved for certain businesses. Pick the eligibility you want to see. Change it any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='atoggle' aria-expanded='" + openA + "'><span>" + h(aLabel()) + "</span><span>&#9662;</span></button>" +
        (openA ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='anone'>" + ((d.aside.length >= ASIDE_OPTS.length) ? "Clear all" : "Select all") + "</button></div>" + ASIDE_OPTS.map(function (o) {
          return "<label class='wz-row'><input type='checkbox' data-apick='" + h(o[0]) + "'" + (d.aside.indexOf(o[0]) >= 0 ? " checked" : "") + "> <span>" + h(o[1]) + "</span></label>";
        }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button data-a='prev'>&larr; Back</button><button class='pri' data-a='finish'>Show me my RFQs</button></div></div>";
    }
    // Step 2: which entities (registrations) the vendor holds. Nothing ticked = no restriction.
    var openR = false;
    function rLabel() { var o = SOURCES.filter(function (x) { return d.reg.indexOf(x.id) >= 0; }); return !o.length ? "Not registered / show all" : o.length === 1 ? o[0].label : o.length + " selected"; }
    function drawR() {
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 2</p><h2>Which entities are you registered with?</h2>" +
        "<p class='wz-note'>Pick the portals where your company is already registered as a vendor. Bids from those sources are shown. Leave empty to see every source. Change it any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='rtoggle' aria-expanded='" + openR + "'><span>" + h(rLabel()) + "</span><span>&#9662;</span></button>" +
        (openR ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='rnone'>" + (d.reg.length >= SOURCES.length ? "Clear all" : "Select all") + "</button></div>" + SOURCES.map(function (o) {
          return "<label class='wz-row'><input type='checkbox' data-rpick='" + h(o.id) + "'" + (d.reg.indexOf(o.id) >= 0 ? " checked" : "") + "> <span>" + h(o.label) + " " + (o.reg ? "<em class='wz-note'>(" + h(o.reg) + ")</em>" : "") + "</span></label>";
        }).join("") + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button data-a='prev'>&larr; Back</button><button class='pri' data-a='next'>Next &rarr;</button></div></div>";
    }
    function collectJ() {
      var boxes = back.querySelectorAll("[data-jur]");
      if (boxes.length) { d.where = []; Array.prototype.forEach.call(boxes, function (el) { if (el.checked) d.where.push(el.dataset.jur); }); }
    }
    function draw() {
      try { sessionStorage.setItem(WZKEY, JSON.stringify({ step: step, d: d })); } catch (e) {}
      drawStep();
      side();
    }
    // Right-hand sidebar: what is selected on each step so far. Rebuilt after every redraw / tick.
    function sideItems(ids, labelOf, none) {
      var names = ids.map(labelOf).filter(Boolean);
      if (!names.length) return "<span class='wz-side-none'>" + none + "</span>";
      return "<ul>" + names.map(function (n) { return "<li>" + h(n) + "</li>"; }).join("") + "</ul>";
    }
    var sideOpen = {};
    function side() {
      if (!back) return;
      if (!J.length) loadJ();
      var where = d.where || cur.where || [];
      var items = [
        ["Request categories", d.cats.length >= ALL.length && ALL.length ? "<span class='wz-side-none'>All categories</span>" : sideItems(d.cats, function (v) { for (var i = 0; i < ALL.length; i++) if (ALL[i].v === v) return ALL[i].label; return ""; }, "All categories")],
        ["Registered entities", sideItems(d.reg, function (id) { var s = SOURCES.filter(function (x) { return x.id === id; })[0]; return s ? s.label : ""; }, "Not registered / show all")],
        ["Jurisdictions", J.length && where.length >= J.length ? "<span class='wz-side-none'>All locations</span>" : sideItems(where, function (v) { for (var i = 0; i < J.length; i++) if (J[i].v === v) return J[i].label; return ""; }, "All locations")],
        ["Eligibility", sideItems(d.aside, function (v) { for (var i = 0; i < ASIDE_OPTS.length; i++) if (ASIDE_OPTS[i][0] === v) return ASIDE_OPTS[i][1]; return ""; }, "Anyone")]
      ];
      var el = back.querySelector(".wz-side");
      if (!el) {
        el = document.createElement("aside"); el.className = "wz-side"; el.setAttribute("aria-label", "Your selections");
        el.innerHTML = "<details open class='wz-sel-box'><summary>Your selections</summary><div class='wz-side-sel'></div></details>";
        back.appendChild(el);
      }
      botUi();
      // Each section is its own collapsible <details>; remember which ones the user opened/closed across rebuilds.
      var box = el.querySelector(".wz-side-sel");
      if (!box.dataset.w) { box.dataset.w = "1"; box.addEventListener("click", function (e) { var s = e.target.closest && e.target.closest("summary"); if (s && s.parentNode.dataset.i) sideOpen[s.parentNode.dataset.i] = !s.parentNode.open; }); }
      box.innerHTML = items.map(function (x, i) {
        var open = sideOpen[i] !== undefined ? sideOpen[i] : i + 1 === step;
        return "<details data-i='" + i + "' class='wz-side-sec" + (i + 1 === step ? " cur" : "") + "'" + (open ? " open" : "") + "><summary>" + (i + 1) + ". " + x[0] + "</summary>" + x[1] + "</details>";
      }).join("");
    }

    // ---------- helper bot ----------
    // Runs entirely in this browser: reads a plain-English description of the business and suggests categories,
    // locations and eligibility. It only suggests; nothing changes until "Use these" is pressed.
    var STOP = {}; "the and for our we you your with that this from are have has sell selling sale business company provide providing products product service services goods other supply work based also mostly mainly into like all any new".split(" ").forEach(function (w) { STOP[w] = 1; });
    function stem(w) {
      w = String(w).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (w.length > 4) { if (/ies$/.test(w)) w = w.slice(0, -3) + "y"; else if (/(ses|xes|ches|shes)$/.test(w)) w = w.slice(0, -2); else if (/s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1); }
      return w;
    }
    var SYN = [
      [/food|cater|restaurant|grocer|meal|snack|beverage/, ["food", "meal", "beverage", "grocery"]],
      [/construct|contractor|building|roof|plumb|electrician|hvac/, ["construction", "building", "repair", "electrical"]],
      [/clean|janitor|custodial|sanitiz/, ["janitorial", "cleaning", "sanitation"]],
      [/medical|health|pharma|clinic|hospital|nurs/, ["medical", "health", "pharmaceutical", "drug"]],
      [/software|\bit\b|computer|cyber|tech|network|laptop|server/, ["computer", "software", "information", "technology", "network"]],
      [/vehicle|truck|\bauto|\bcars?\b|fleet|tire/, ["vehicle", "automotive", "truck"]],
      [/office|furniture|stationery|desk/, ["office", "furniture"]],
      [/print|toner|\bink\b|copier/, ["printing", "printer", "toner"]],
      [/uniform|clothing|apparel|textile|boots/, ["clothing", "uniform", "apparel", "textile"]],
      [/security|guard|surveillance|alarm/, ["security", "safety", "surveillance"]],
      [/landscap|lawn|grounds|\btrees?\b/, ["landscaping", "grounds", "lawn"]],
      [/consult|training|staffing|professional/, ["consulting", "professional", "training", "management"]],
      [/\broad|paving|highway|bridge|concrete|asphalt/, ["road", "highway", "paving", "bridge", "concrete"]],
      [/tools?\b|hardware|fastener/, ["tools", "hardware"]]
    ];
    var ASIDE_RE = [["vet", /veteran|sdvosb|\bvosb\b/i], ["women", /\bwom[ae]n|\bwosb\b|female/i], ["small", /small business|\bsmb\b|small (company|shop|firm)/i], ["other", /hubzone|8\(a\)|\b8a\b|minority/i]];
    var REG_RE = [["fed", /sam\.gov|\bsam\b/i], ["nyc", /passport/i], ["pa", /emarketplace/i], ["tx", /cmbl|\bcentralized master/i]];
    function suggest(text, site) {
      var low = text.toLowerCase(), terms = {}, s = { cats: [], where: [], aside: [], reg: [], all: false };
      low.split(/[^a-z0-9]+/).forEach(function (w) { var t = stem(w); if (t.length > 2 && !STOP[t]) terms[t] = 1; });
      SYN.forEach(function (x) { if (x[0].test(low)) x[1].forEach(function (w) { terms[stem(w)] = 1; }); });
      CATS.forEach(function (c) {
        if (c.kw.some(function (k) { return new RegExp("\\b" + esc(k).replace(/\s+/g, "\\s+") + "(?:s|es)?\\b").test(low); }))
          c.kw.forEach(function (k) { k.split(" ").forEach(function (w) { var t = stem(w); if (!STOP[t]) terms[t] = 1; }); });
      });
      loadAll();
      var hits = [];
      ALL.forEach(function (o) {
        var lt = {}, sc = 0; o.label.split(/[^A-Za-z0-9]+/).forEach(function (w) { lt[stem(w)] = 1; });
        for (var t in terms) if (lt[t]) sc++;
        if (sc >= (site ? 2 : 1)) hits.push({ v: o.v, label: o.label, sc: sc });
      });
      hits.sort(function (a, b) { return b.sc - a.sc; });
      s.cats = hits.slice(0, site ? 25 : 40);
      loadJ();
      if (site) return finishSite(s, text);
      if (/nationwide|all states|anywhere|everywhere|across the (us|country)/.test(low)) s.all = true;
      else J.forEach(function (o) {
        var nm = String(o.label).replace(/\(.*?\)/g, "").trim().toLowerCase();
        if (nm && new RegExp("\\b" + esc(nm) + "\\b").test(low) || (/federal/i.test(o.label) && /federal|sam\.gov|government/.test(low))) s.where.push(o);
      });
      ASIDE_RE.forEach(function (x) { if (x[1].test(text)) s.aside.push(x[0]); });
      REG_RE.forEach(function (x) { if (x[1].test(text)) s.reg.push(x[0]); });
      return s;
    }
    function finishSite(s, text) { // a website says what a company sells, not where it bids: only eligibility and registrations are read from it
      ASIDE_RE.forEach(function (x) { if (x[1].test(text)) s.aside.push(x[0]); });
      REG_RE.forEach(function (x) { if (x[1].test(text)) s.reg.push(x[0]); });
      return s;
    }
    function names(arr, max) { var n = arr.length; return arr.slice(0, max).join(", ") + (n > max ? " and " + (n - max) + " more" : ""); }
    var chat = [{ me: false, text: "Hi! Enter your website and I'll read it to suggest request categories. Or just describe your business below." }];
    function botLog() {
      var log = back && back.querySelector(".bt-log"); if (!log) return;
      log.innerHTML = chat.map(function (m, i) {
        var body = m.html || h(m.text);
        if (m.sug && !m.done) body += "<div><button type='button' class='pri' data-b='apply' data-m='" + i + "'>Use these</button></div>";
        if (m.done) body += "<div class='wz-note'>Applied.</div>";
        return "<div class='wz-msg" + (m.me ? " me" : "") + "'>" + body + "</div>";
      }).join("");
      log.scrollTop = log.scrollHeight;
    }
    var ICON = "<svg viewBox='0 0 32 32' aria-hidden='true'><line x1='16' y1='3' x2='16' y2='8' stroke='#fff' stroke-width='2' stroke-linecap='round'/><circle cx='16' cy='3.5' r='2' fill='#fbbf24'/><rect x='4' y='8' width='24' height='17' rx='6' fill='#fff'/><circle cx='11.5' cy='16' r='2.6' fill='#1e3a5f'/><circle cx='20.5' cy='16' r='2.6' fill='#1e3a5f'/><path d='M12 21.2q4 2.4 8 0' stroke='#1e3a5f' stroke-width='1.8' fill='none' stroke-linecap='round'/><rect x='1' y='13' width='3' height='6' rx='1.5' fill='#fff'/><rect x='28' y='13' width='3' height='6' rx='1.5' fill='#fff'/></svg>";
    var botOpen = false, reading = false;
    // The icon button (always visible) and the chat panel it opens. Rebuilt with the wizard page; chat history is kept in `chat`.
    function botUi() {
      var f = back.querySelector(".bt-fab"), pn = back.querySelector(".bt-panel");
      if (botOpen && !pn) {
        if (f) f.remove();
        pn = document.createElement("div"); pn.className = "bt-panel"; pn.setAttribute("role", "dialog"); pn.setAttribute("aria-label", "Helper bot");
        pn.innerHTML = "<div class='bt-head'>" + ICON + "<span>Helper bot</span><button type='button' data-b='close' aria-label='Close helper bot'>&times;</button></div>" +
          "<div class='bt-log' aria-live='polite'></div><div class='bt-form'><label for='bt-site'>Your website</label>" +
          "<div class='bt-row'><input id='bt-site' class='bt-site' type='text' inputmode='url' placeholder='yourcompany.com' autocomplete='url'><button type='button' class='pri' data-b='site'" + (reading ? " disabled" : "") + ">" + (reading ? "Reading&hellip;" : "Read it") + "</button></div>" +
          "<label for='bt-in'>Or describe your business</label><textarea id='bt-in' rows='2' class='bt-in' placeholder='e.g. We sell laptops and toner to schools. Veteran-owned.'></textarea>" +
          "<button type='button' class='pri bt-go' data-b='ask'>Suggest options</button></div>";
        back.appendChild(pn); botLog();
      } else if (!botOpen && !f) {
        if (pn) pn.remove();
        f = document.createElement("button"); f.type = "button"; f.className = "bt-fab"; f.setAttribute("data-b", "open"); f.setAttribute("aria-label", "Open helper bot");
        f.innerHTML = ICON + "<span>Helper bot</span>"; back.appendChild(f);
      }
    }
    function botSay(m) { chat.push(m); botLog(); }
    function botSite() {
      var box = back.querySelector(".bt-site"), url = (box && box.value || "").trim(); if (!url || reading) return;
      chat.push({ me: true, text: url }); reading = true; botLog();
      var go = back.querySelector("[data-b='site']"); if (go) { go.disabled = true; go.textContent = "Reading\u2026"; }
      var done = function () { reading = false; var g = back && back.querySelector("[data-b='site']"); if (g) { g.disabled = false; g.textContent = "Read it"; } };
      fetch("/api/site-text?url=" + encodeURIComponent(url)).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
        done(); if (!back) return;
        if (!x.ok) return botSay({ me: false, text: (x.j && x.j.error) || "I could not read that website." });
        var s = suggest(x.j.text, true), lines = [];
        if (s.cats.length) lines.push("<b>Categories (" + s.cats.length + "):</b> " + h(names(s.cats.map(function (o) { return o.label; }), 5)));
        if (s.aside.length) lines.push("<b>Eligibility:</b> " + h(names(s.aside.map(function (v) { for (var i = 0; i < ASIDE_OPTS.length; i++) if (ASIDE_OPTS[i][0] === v) return ASIDE_OPTS[i][1]; return v; }), 5)));
        if (s.reg.length) lines.push("<b>Registered with:</b> " + h(names(s.reg.map(function (v) { var o = SOURCES.filter(function (q) { return q.id === v; })[0]; return o ? o.label : v; }), 5)));
        if (lines.length) botSay({ me: false, html: "I read <b>" + h(x.j.title || x.j.site) + "</b>. Here is what I would suggest:<br>" + lines.join("<br>") + "<br><span class='wz-note'>Websites do not say where you bid, so locations are left to you.</span>", sug: s });
        else botSay({ me: false, text: "I read the site but could not match it to any category. Try describing what you sell instead." });
      }, function () { done(); botSay({ me: false, text: "I could not reach the website reader. It needs the tracker service running. You can describe your business instead." }); });
    }
    function botAsk() {
      var box = back.querySelector(".bt-in"), text = (box.value || "").trim(); if (!text) return;
      box.value = "";
      chat.push({ me: true, text: text });
      var s = suggest(text), lines = [];
      if (s.cats.length) lines.push("<b>Categories (" + s.cats.length + "):</b> " + h(names(s.cats.map(function (o) { return o.label; }), 5)));
      if (s.all) lines.push("<b>Locations:</b> all");
      else if (s.where.length) lines.push("<b>Locations:</b> " + h(names(s.where.map(function (o) { return o.label; }), 5)));
      if (s.aside.length) lines.push("<b>Eligibility:</b> " + h(names(s.aside.map(function (v) { for (var i = 0; i < ASIDE_OPTS.length; i++) if (ASIDE_OPTS[i][0] === v) return ASIDE_OPTS[i][1]; return v; }), 5)));
      if (s.reg.length) lines.push("<b>Registered with:</b> " + h(names(s.reg.map(function (v) { var x = SOURCES.filter(function (o) { return o.id === v; })[0]; return x ? x.label : v; }), 5)));
      if (lines.length) chat.push({ me: false, html: "Here is what I would suggest:<br>" + lines.join("<br>") + "<br><span class='wz-note'>You can still change everything in the steps.</span>", sug: s });
      else chat.push({ me: false, text: "I could not match that to any category. Try naming the products or services you sell, for example: IT hardware and toner, Texas, veteran-owned." });
      botLog();
    }
    function botApply(m) {
      var s = chat[m] && chat[m].sug; if (!s) return;
      if (step === 3) collectJ(); else if (step === 1) collect();
      if (s.cats.length) d.cats = s.cats.map(function (o) { return o.v; });
      if (s.all) d.where = []; else if (s.where.length) d.where = s.where.map(function (o) { return o.v; });
      if (s.aside.length) d.aside = s.aside.slice();
      if (s.reg.length) d.reg = s.reg.slice();
      chat[m].done = true; botLog(); draw();
    }
    back.addEventListener("click", function (e) {
      var b = e.target.closest("[data-b]"); if (!b) return;
      var k = b.dataset.b;
      if (k === "ask") botAsk(); else if (k === "site") botSite(); else if (k === "apply") botApply(+b.dataset.m);
      else if (k === "open" || k === "close") { botOpen = k === "open"; botUi(); var i = back.querySelector(".bt-site"); if (botOpen && i) i.focus(); }
    });
    back.addEventListener("keydown", function (e) {
      var c = e.target.classList; if (e.key !== "Enter" || !c) return;
      if (c.contains("bt-site")) { e.preventDefault(); botSite(); } else if (!e.shiftKey && c.contains("bt-in")) { e.preventDefault(); botAsk(); }
    });
    function drawStep() {
      if (step === 4) return drawA();
      if (step === 3) return drawJ();
      if (step === 2) return drawR();
      if (!openDd) loadAll(); // pick up bid categories that arrived after the page loaded (live data)
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><p class='wz-step'>Step 1</p><h2>Which request categories would you like to see?</h2>" +
        "<p class='wz-note'>Every category is listed; the ones that apply to Discover Group, Inc. are pre-selected. Change them any time.</p>" +
        "<div class='wz-dd'><button type='button' class='wz-dd-btn' data-a='toggle' aria-expanded='" + openDd + "'><span>" + label() + "</span><span>&#9662;</span></button>" +
        (openDd ? "<div class='wz-dd-list'><div class='wz-dd-tools'><button type='button' class='link' data-a='none'>" + ((d.cats.length >= ALL.length) ? "Clear all" : "Select all") + "</button></div>" +
          listHtml() + "</div>" : "") + "</div>" +
        "<div class='wz-btns'><button class='pri' data-a='next'>Next &rarr;</button></div></div>";
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
      else if (t.dataset.apick != null) {
        d.aside = Array.prototype.map.call(back.querySelectorAll("[data-apick]:checked"), function (el) { return el.dataset.apick; });
        var ab = back.querySelector(".wz-dd-btn span"); if (ab) ab.textContent = aLabel();
      }
      else if (t.dataset.rpick != null) {
        d.reg = Array.prototype.map.call(back.querySelectorAll("[data-rpick]:checked"), function (el) { return el.dataset.rpick; });
        var rb = back.querySelector(".wz-dd-btn span"); if (rb) rb.textContent = rLabel();
      }
      else if (t.dataset.jur) { collectJ(); var jl = back.querySelector(".wz-dd-btn span"); if (jl) jl.textContent = jLabel(); }
      side();
    });
    back.addEventListener("click", function (e) {
      var g = e.target.closest("[data-g]"); if (!g) return;
      var gr = groups()[+g.dataset.g], kids = back.querySelector("[data-kids='" + g.dataset.g + "']");
      openG[gr.name] = kids.hidden; kids.hidden = !kids.hidden;
      g.setAttribute("aria-expanded", String(!kids.hidden)); g.querySelector(".wz-arr").innerHTML = kids.hidden ? "&#9656;" : "&#9662;";
    });
    try { for (var k = 1; k <= step; k++) history.pushState({ wz: k }, ""); pushed = step; } catch (x) { pushed = 0; }
    onPop = function (ev) {
      var s = ev.state && ev.state.wz;
      if (!s) { close(); return; } // Back past step 1: leave the wizard
      if (step === 3) collectJ(); else if (step === 1) collect();
      step = s; openJ = openA = openR = false; draw();
    };
    window.addEventListener("popstate", onPop);
    back.addEventListener("click", function (e) {
      var a = e.target.closest("[data-a]"); if (!a) return;
      var act = a.dataset.a;
      if (step === 3) collectJ(); else if (step === 1) collect();
      if (pushed && act === "prev") { history.back(); return; }
      var before = step;
      if (act === "toggle") openDd = !openDd;
      else if (act === "none") d.cats = d.cats.length >= ALL.length ? [] : ALL.map(function (o) { return o.v; });
      else if (act === "rtoggle") openR = !openR;
      else if (act === "rnone") d.reg = d.reg.length >= SOURCES.length ? [] : SOURCES.map(function (o) { return o.id; });
      else if (act === "jtoggle") openJ = !openJ;
      else if (act === "atoggle") openA = !openA;
      else if (act === "anone") d.aside = d.aside.length >= ASIDE_OPTS.length ? [] : ASIDE_OPTS.map(function (o) { return o[0]; });
      else if (act === "jnone") d.where = d.where.length >= J.length ? [] : J.map(function (o) { return o.v; });
      else if (act === "jcity" || act === "jstate") {
        var gn = act === "jcity" ? "City" : "States", gv = J.filter(function (o) { return o.group === gn; }).map(function (o) { return o.v; });
        var allOn = gv.every(function (x) { return d.where.indexOf(x) >= 0; });
        d.where = d.where.filter(function (x) { return gv.indexOf(x) < 0; }).concat(allOn ? [] : gv);
      }
      else if (act === "prev") { step = Math.max(1, step - 1); openJ = openA = openR = false; }
      else if (act === "next") { step = Math.min(4, step + 1); openJ = openA = openR = false; }
      else if (act === "finish") {
        var every = !d.where.length || (J.length && J.every(function (o) { return d.where.indexOf(o.v) >= 0; }));
        save({ catsV: 2, cats: d.cats, where: every ? [] : d.where, value: d.value, aside: d.aside, reg: d.reg.length >= SOURCES.length ? [] : d.reg, vmin: d.vmin, vmax: d.vmax, extra: d.extra.trim(), src: d.src, saved: new Date().toISOString() });
        try { localStorage.removeItem(SKIP); } catch (x) {}
        // Show a "working" message, let it paint, then do the (possibly slow) list compile.
        back.innerHTML = "<div class='wz' role='status' aria-live='polite' style='text-align:center'><div class='wz-spin'></div><h2>Compiling your RFQ list&hellip;</h2><p class='wz-note'>Matching bids to your choices. This can take a moment.</p></div>";
        unhook(); if (pushed) { var n = step; pushed = 0; history.go(-n); } // drop the wizard's history entries
        setTimeout(function () { close(); window.dispatchEvent(new Event("rfqprofilechange")); }, 60);
        return;
      }
      if (pushed && step > before) { try { history.pushState({ wz: step }, ""); pushed++; } catch (x) {} }
      draw();
    });
    draw();
  }

  // Which source a bid belongs to.
  function sourceFor(level, code) {
    return level === "Federal" ? "fed" : String(code || "").toLowerCase();
  }
  window.RFQProfile = { get: load, match: match, categories: categories, catHits: catHits, open: open, sourceFor: sourceFor, sourceInfo: function (id) { for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === id) return SOURCES[i]; return null; }, valueOpts: VALUE_OPTS, asideOpts: ASIDE_OPTS, valueOk: valueOk, regOpts: SOURCES.map(function (x) { return [x.id, x.label]; }) };
  // First visit: offer the setup once. (Skipping is remembered; the toolbar button reopens it.)
  // Opened immediately (not on window "load") so the main page never paints before the wizard hides it.
  // The bid-category list comes from home.js, which loads after this file, so wait until every script has run.
  // A fresh visit starts at wizard step 1; a refresh (reload) restores the current step — except the page's own reload right after a data refresh.
  var autoReload = false;
  try { autoReload = !!sessionStorage.getItem("rfqAutoReload"); } catch (e) {}
  // The wizard opens at step 1 only on the first load of this tab session. Any later load (refresh) reopens the wizard
  // only if it was open, at its current step; otherwise the main page just refreshes in place.
  var firstLoad = true;
  try { firstLoad = !sessionStorage.getItem("rfqStarted"); sessionStorage.setItem("rfqStarted", "1"); } catch (e) {}
  var hadState = false;
  try { hadState = !!sessionStorage.getItem(WZKEY); } catch (e) {}
  if (firstLoad) wzClear();
  if (!autoReload && (firstLoad || hadState)) {
    document.body.classList.add("wz-open");
    var restore = !firstLoad;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { open(restore); }); else open(restore);
  }
})();
