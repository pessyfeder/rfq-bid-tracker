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
    ".wz-back{position:fixed;inset:0;background:rgba(20,28,40,.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:12px}" +
    ".wz{background:#fff;color:#1c2430;border-radius:10px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:20px 22px;box-shadow:0 10px 40px rgba(0,0,0,.3)}" +
    ".wz h2{margin:0 0 4px;font-size:18px}.wz .wz-step{color:#6b7686;font-size:12px;margin-bottom:12px}" +
    ".wz p{margin:6px 0}.wz label.wz-row{display:flex;gap:8px;align-items:flex-start;padding:4px 0;cursor:pointer}" +
    ".wz textarea,.wz input[type=text]{width:100%;font:inherit;padding:6px 8px;border:1px solid #e3e7ed;border-radius:6px}" +
    ".wz .wz-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}" +
    ".wz button{font:inherit;padding:6px 14px;border-radius:6px;border:1px solid #1f4e8c;background:#fff;color:#1f4e8c;cursor:pointer}" +
    ".wz button.pri{background:#1f4e8c;color:#fff}.wz button.link{border:0;background:none;text-decoration:underline;padding:6px 4px}" +
    ".wz .wz-src{border:1px solid #e3e7ed;border-radius:8px;padding:10px 12px;margin:10px 0}.wz .wz-src b{display:block;margin-bottom:4px}" +
    ".wz .wz-src ol{margin:6px 0 0;padding-left:20px;color:#444;font-size:13px}.wz .wz-seg label{margin-right:14px;cursor:pointer}" +
    ".wz .wz-note{color:#6b7686;font-size:12px}.wz .wz-sum li{margin:3px 0}" +
    ".match-chip{display:inline-block;background:#e3f4ea;color:#1d7a46;border-radius:4px;padding:1px 6px;margin:0 6px 0 0;font-size:12px;font-weight:600;cursor:help}";
  document.head.appendChild(css);

  var back = null;
  function close() { if (back) { back.remove(); back = null; } }
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function open() {
    var cur = load() || {};
    var d = { cats: (cur.cats || CATS.map(function (c) { return c.id; })).slice(), extra: cur.extra || "",
      src: (cur.src || ["fed", "tx", "pa", "nyc"]).slice(), reg: Object.assign({}, cur.reg || {}) };
    var step = 0;
    close();
    back = document.createElement("div"); back.className = "wz-back";
    back.addEventListener("click", function (e) { if (e.target === back) skip(); });
    document.body.appendChild(back);

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
        h2 = "All set";
        var todo = srcList().filter(function (s) { return d.reg[s.id] !== "yes"; });
        html = "<ul class='wz-sum'><li><b>Selling:</b> " + h(keywords({ cats: d.cats, extra: d.extra }).length ? d.cats.map(function (id) { return CATS.filter(function (c) { return c.id === id; })[0].label; }).concat(d.extra.trim() ? [d.extra.trim()] : []).join("; ") : "nothing selected") + "</li>" +
          "<li><b>Bidding in:</b> " + h(srcList().map(function (s) { return s.label; }).join(", ") || "none") + "</li>" +
          "<li><b>Still to register:</b> " + (todo.length ? h(todo.map(function (s) { return s.label + (d.reg[s.id] === "unsure" ? " (check)" : ""); }).join(", ")) : "nothing") + "</li></ul>" +
          "<p class='wz-note'>Reopen this any time with &ldquo;My profile&rdquo; in the toolbar.</p>";
      }
      return { h2: h2, html: html };
    }

    function draw() {
      var b = body(), total = steps(), last = step === total - 1;
      back.innerHTML = "<div class='wz' role='dialog' aria-modal='true' aria-label='Setup'><h2>" + b.h2 + "</h2><div class='wz-step'>Step " + (step + 1) + " of " + total + "</div>" + b.html +
        "<div class='wz-btns'><button class='link' data-a='skip'>" + (load() ? "Cancel" : "Skip for now") + "</button>" + (step ? "<button data-a='back'>Back</button>" : "") +
        "<button class='pri' data-a='" + (last ? "done" : "next") + "'>" + (last ? "Save" : "Next") + "</button></div></div>";
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
    document.addEventListener("keydown", function esc(e) { if (!back) return document.removeEventListener("keydown", esc); if (e.key === "Escape") skip(); });
    draw();
  }

  window.RFQProfile = { get: load, match: match, open: open };
  // First visit: offer the setup once. (Skipping is remembered; the toolbar button reopens it.)
  window.addEventListener("load", function () {
    var skipped = false; try { skipped = !!localStorage.getItem(SKIP); } catch (e) {}
    if (!load() && !skipped) open();
  });
})();
