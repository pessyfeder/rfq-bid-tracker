// Main screen: a search page in the style of a bid portal. Title, one row of filters (keyword, Agency Type, Category, Location,
// Published, Status), "Filtered by" chips, then a results bar and a list of bids with Published / Closing dates.
// Category starts out selected to the products from the setup wizard (pre-filled from the vendor's website).
// The original full table still exists in index.html as a hidden data layer and is never shown.
(function () {
  var $app = document.getElementById("app");
  if (!$app) return;
  var DAY = 86400000, PAGE = 25;
  var st = { kw: "", cats: null, level: [], where: [], close: "any", posted: "any", value: "any", aside: "any", reg: "any", sort: "new", shown: PAGE, dd: null, more: false, regOpen: {} };

  var css = document.createElement("style");
  css.textContent =
    "body{background:#fff;margin:0}" +
    ".hm{font:15px/1.5 Roboto,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f3347}.hm *{box-sizing:border-box}.hm button,.hm select,.hm input{font:inherit}.hm button{cursor:pointer}" +
    ".hm-in{max-width:1180px;margin:0 auto;padding:0 24px}" +
    ".hm-nav{border-bottom:1px solid #e3e8ef;background:#fff}.hm-nav .hm-in{display:flex;align-items:center;gap:10px;height:56px}.hm-logo{font-weight:800;font-size:20px;letter-spacing:-.02em;color:#0b3a57;margin-right:auto}.hm-logo i{font-style:normal;color:#d6204e}" +
    ".hm-btn{border:1px solid #0a5276;background:#fff;color:#0a5276;border-radius:6px;padding:7px 16px;font-weight:600}.hm-btn:hover{background:#f0f6fa}" +
    ".hm-title{text-align:center;padding:34px 0 8px}.hm-title h1{margin:0;font-size:34px;font-weight:600;color:#1f3a56;letter-spacing:-.01em}.hm-title p{margin:6px 0 0;color:#64748b;font-size:14px}" +
    /* filter row */
    ".hm-bar{display:flex;gap:12px;align-items:stretch;margin-top:26px}.hm-kw{flex:1.7 1 240px;min-width:0;display:flex;align-items:center;gap:10px;border:1px solid #d3dbe4;border-radius:4px;padding:0 18px;background:#fff;height:54px}.hm-kw:focus-within{border-color:#0a5276;box-shadow:0 0 0 3px #0a527622}" +
    ".hm-kw input{flex:1;min-width:0;border:0;outline:0;font-size:18px;color:#1f3a56;background:transparent;height:100%}.hm-kw input::placeholder{color:#7b8a9a}.hm-kw svg{flex:none;color:#0a5276}" +
    ".hm-fields{display:contents}.hm-field{position:relative;flex:1 1 120px;min-width:0}" +
    ".hm-field select,.hm-dd-btn{width:100%;height:54px;border:1px solid #d3dbe4;border-radius:4px;background:#fff;color:#2d4256;font-weight:600;font-size:15px;padding:0 38px 0 16px;text-align:left;appearance:none;-webkit-appearance:none}" +
    ".hm-field select{background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%232d4256' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 9l7 7 7-7'/%3E%3C/svg%3E\") no-repeat right 14px center}" +
    ".hm-dd-btn{display:block;position:relative}.hm-dd-btn span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hm-dd-btn:after{content:'';position:absolute;right:16px;top:50%;width:7px;height:7px;border-right:2px solid #2d4256;border-bottom:2px solid #2d4256;transform:translateY(-70%) rotate(45deg)}" +
    ".hm-field select:focus,.hm-dd-btn:focus{outline:2px solid #0a527655;border-color:#0a5276}.hm-field.open .hm-dd-btn,.hm-dd-btn.on,.hm-field select.on{border-color:#0a5276;color:#0a5276}" +
    ".hm-dd-panel{display:none;position:absolute;z-index:30;left:0;top:100%;margin-top:4px;min-width:100%;width:340px;max-width:92vw;background:#fff;border:1px solid #c5cdd8;border-radius:6px;box-shadow:0 10px 30px rgba(15,23,42,.2)}" +
    ".hm-field.open .hm-dd-panel{display:block}.hm-field.rt .hm-dd-panel{left:auto;right:0}" +
    ".hm-dd-top{display:flex;gap:14px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid #e5e9f0;font-size:13px}.hm-dd-top button{border:0;background:none;color:#0a5276;text-decoration:underline;font-weight:500;padding:0}" +
    ".hm-dd-list{max-height:320px;overflow:auto;padding:4px 0}.hm-grp{padding:8px 14px 2px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}" +
    ".hm-opt{display:flex;gap:10px;align-items:center;padding:6px 14px;cursor:pointer;color:#1f3347;margin:0;font-size:14px}.hm-opt:hover{background:#f0f6fa}.hm-opt input{width:16px;height:16px;accent-color:#0a5276;flex:none;margin:0}.hm-opt span{flex:1;min-width:0}.hm-opt em{font-style:normal;color:#94a3b8;font-size:12px}" +
    ".hm-morerow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}.hm-morerow .hm-field{flex:none}" +
    ".hm-tog{border:0;background:none;color:#0a5276;font-weight:600;text-decoration:underline;padding:10px 0 0}" +
    /* filtered by */
    ".hm-filt{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:20px 0 0;min-height:44px}.hm-filt b{font-weight:600;color:#1f3a56}" +
    ".hm-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #d3dbe4;background:#f4f6f9;color:#1f3a56;font-weight:600;border-radius:999px;padding:9px 12px 9px 16px}.hm-chip:hover{background:#eaeff5}.hm-chip svg{color:#7b8a9a}" +
    ".hm-clear{border:0;background:none;color:#0a5276;font-weight:600;padding:6px}.hm-clear:hover{text-decoration:underline}" +
    /* results */
    ".hm-resbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#07506f;color:#fff;margin-top:22px;padding:12px 22px;font-weight:500}.hm-resbar .hm-cnt{margin-right:auto}" +
    ".hm-resbar select{height:50px;min-width:260px;max-width:100%;border:0;border-radius:4px;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%232d4256' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 9l7 7 7-7'/%3E%3C/svg%3E\") no-repeat right 16px center;color:#2d4256;padding:0 40px 0 16px;appearance:none;-webkit-appearance:none}" +
    ".hm-list{border:1px solid #d9dfe7;border-top:0;margin-bottom:12px}.hm-item{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:6px 16px;align-items:start;padding:18px 20px;border-bottom:1px solid #e3e8ef}.hm-item:last-child{border-bottom:0}.hm-item:hover{background:#fafcfd}" +
    ".hm-ic{width:56px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#e9eef4;color:#475a6e;font-weight:700;font-size:15px;margin-top:2px}.hm-ic.Federal{background:#e3ecf7;color:#1e3a5f}.hm-ic.Local{background:#e1f0ee;color:#0f5f58}.hm-ic.State{background:#e9e8f4;color:#4a4a8a}" +
    ".hm-item h3{margin:0;font-size:19px;font-weight:500;line-height:1.35}.hm-item h3 a{color:#1f3a56;text-decoration:none}.hm-item h3 a:hover{color:#0a5276;text-decoration:underline}.hm-sub{color:#5f6f7f;font-size:15px;margin-top:2px}" +
    ".hm-dates{display:grid;grid-template-columns:auto auto;gap:6px 14px;font-size:15px;align-content:start;min-width:250px}.hm-dates div{display:flex;align-items:center;gap:8px}.hm-dates svg{color:#7b8a9a;flex:none}.hm-dates b{font-weight:600}.hm-dates .soon{color:#a12a1f;font-weight:600}" +
    ".hm-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.hm-tag{border-radius:4px;padding:1px 8px;font-size:12px;font-weight:600;background:#eef1f5;color:#374151}.hm-tag.match{background:#e6f2ea;color:#1d6b3e;cursor:help}.hm-tag.aside{background:#fdf1d8;color:#8a5a0b}" +
    ".hm-reg{grid-column:2 / -1;margin:4px 0 0;padding:8px 12px;background:#fdf6e9;border:1px solid #ecd9b0;border-left:3px solid #b45309;border-radius:6px;font-size:13px}.hm-reg ol{margin:6px 0;padding-left:20px}.hm-reg a{color:#1e3a5f;font-weight:600}" +
    ".hm-more{border:0;background:none;color:#0a5276;font-weight:500;text-decoration:underline;padding:2px 8px}" +
    ".hm-go{display:inline-block;background:#0a5276;color:#fff;border:0;border-radius:6px;padding:8px 16px;font-weight:500}" +
    ".hm-empty{text-align:center;padding:48px 16px;border:1px solid #d9dfe7;border-top:0}.hm-empty h3{margin:0 0 6px}" +
    ".hm-showmore{display:block;margin:14px auto 60px;border:1px solid #0a5276;background:#fff;color:#0a5276;border-radius:6px;padding:9px 26px;font-weight:600}" +
    "@media(max-width:980px){.hm-bar{flex-wrap:wrap}.hm-field{flex:1 1 30%}.hm-field.rt .hm-dd-panel{left:auto;right:0}.hm-item{grid-template-columns:64px minmax(0,1fr)}.hm-dates{grid-column:2;min-width:0;grid-template-columns:auto auto;justify-content:start}}" +
    "@media(max-width:620px){.hm-in{padding:0 14px}.hm-title h1{font-size:26px}.hm-field{flex:1 1 45%}.hm-morerow{grid-template-columns:1fr}.hm-dd-panel{width:92vw}.hm-field:nth-child(odd) .hm-dd-panel{left:0;right:auto}.hm-field:nth-child(even) .hm-dd-panel{left:auto;right:0}.hm-resbar select{min-width:0;width:100%}.hm-item{grid-template-columns:1fr;padding:16px 14px}.hm-ic{display:none}.hm-reg,.hm-dates{grid-column:1}}";
  document.head.appendChild(css);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function safeUrl(u) { return /^https:\/\//i.test(String(u)) ? String(u) : ""; }
  function pDate(s) { var p = String(s).split("-"); return new Date(+p[0], p[1] - 1, +p[2]); }
  function mdy(s) { s = String(s || "").slice(0, 10).split("-"); return s.length === 3 ? s[1] + "/" + s[2] + "/" + s[0] : "Unknown"; }
  function money(n) { return n >= 1e6 ? "$" + +(n / 1e6).toFixed(1) + " million" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "K" : "$" + n; }
  function nice(t) { // ALL-CAPS titles become readable
    t = String(t || "").replace(/[\u0000-\u001f]+/g, " ").trim();
    if (t.length > 8 && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[.:\-]\s*)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return t;
  }

  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var cut = new Date(); cut.setFullYear(cut.getFullYear() + 3); var cutStr = cut.toISOString().slice(0, 10); var todayStr = new Date().toISOString().slice(0, 10);
  var rows = null;
  // A posted date that is missing or in the future is not real (older data copied the due date into it): treat as unknown.
  function realPosted(p) { p = String(p || ""); return p && p.slice(0, 10) <= todayStr ? p : ""; }
  // "Newest" = newest fetched into the app: remember when this browser first saw each item (the data files don't record it).
  var SEEN_KEY = "bf-first-seen";
  function loadSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {}; } catch (e) { return {}; } }

  // Set-asides / who may bid, read from the requirement list and restriction text. "No set-aside found" only means none was stated.
  function asideOf(raw) {
    var t = ((raw.requires || []).join(" ; ") + " ; " + ((raw.details && raw.details.restriction) || "")).replace(/no set.?aside( used)?/ig, "");
    var a = { small: /small business/i.test(t), vet: /SDVOSB|service-disabled|veteran/i.test(t), women: /WOSB|women/i.test(t),
      other: /HUBZone|8\(a\)|\b(SBE|DBE|MBE|WBE|MWBE)\b|minority|disadvantaged/i.test(t) };
    a.any = a.small || a.vet || a.women || a.other;
    return a;
  }
  function stateName(code) {
    var N = window.STATE_NAMES || {};
    return code === "US" ? "Federal (SAM.gov)" : code === "NYC" ? "New York City" : code === "NY" ? "New York State" : N[code] || code;
  }

  function prep() {
    var seen = loadSeen(), nowIso = new Date().toISOString(), changed = false, live = {};
    (window.RFQS || []).forEach(function (r) { live[r.id] = 1; if (!seen[r.id]) { seen[r.id] = nowIso; changed = true; } });
    Object.keys(seen).forEach(function (k) { if (!live[k]) { delete seen[k]; changed = true; } });
    if (changed) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {} }
    rows = (window.RFQS || []).map(function (r) {
      var noDue = !r.due || r.due > cutStr;
      var code = r.level === "Federal" ? "US" : String(r.id).split("-")[0].replace("TXDOT", "TX");
      var val = r.value != null ? r.value : r.valueEst && r.valueEst.kind === "stated" ? r.valueEst.amount : null;
      var w = (r.details && r.details.warnings) || [];
      var title = nice(r.plainTitle || (r.level === "Federal" && window.fedItemTitle ? window.fedItemTitle(r.title, r.scope) : r.title));
      var agency = nice(r.agency), region = (r.details && r.details.region) || "";
      return { raw: r, id: r.id, title: title, agency: agency, level: r.level, code: code, noDue: noDue,
        days: noDue ? null : Math.round((pDate(r.due) - today) / DAY), due: r.due, seen: seen[r.id], value: val,
        region: region, url: safeUrl(r.rfqUrl), old: w.indexOf("Posted over a year ago") !== -1, aside: asideOf(r),
        posted: realPosted(r.posted), hay: (title + " " + agency + " " + region + " " + (r.scope || "") + " " + (r.category || "") + " " + r.id).toLowerCase() };
    }).filter(function (r) { return !(r.days != null && r.days < 0) && !r.old; });
  }

  // ---------- filters ----------
  function P() { return window.RFQProfile ? window.RFQProfile.get() : null; }
  function allCats() { return window.RFQProfile ? window.RFQProfile.categories() : []; }
  function defaultCats() { // what the vendor sells: from the setup wizard (pre-filled from the website), or every product category
    var p = P(), ids = allCats().map(function (c) { return c.id; });
    if (!p) return ids.filter(function (i) { return i !== "extra"; });
    return ids.filter(function (i) { return i === "extra" || (p.cats || []).indexOf(i) >= 0; });
  }
  function selCats() { return st.cats === null ? defaultCats() : st.cats; }
  function hits(r) { return window.RFQProfile ? window.RFQProfile.catHits(r.raw) : {}; }

  var LEVEL_OPT = ["Federal", "State", "Local"];
  var CLOSE_OPT = [["any", "Status"], ["7", "Closing in 7 days"], ["14", "Closing in 14 days"], ["30", "Closing in 30 days"], ["60", "Closing in 60 days"], ["none", "No firm deadline"]];
  var POSTED_OPT = [["any", "Published"], ["3", "Last 3 days"], ["7", "Last 7 days"], ["30", "Last 30 days"]];
  var VALUE_OPT = [["any", "Bid value"], ["under50", "Under $50K"], ["mid", "$50K to $500K"], ["over500", "Over $500K"], ["stated", "Has a stated value"]];
  var ASIDE_OPT = [["any", "Who can bid"], ["open", "Open to all (no set-aside found)"], ["small", "Small business set-aside"], ["vet", "Veteran-owned (SDVOSB)"], ["women", "Women-owned (WOSB)"], ["other", "HUBZone, 8(a), minority-owned"]];
  var REG_OPT = [["any", "Registration"], ["yes", "Only where I'm registered"]];
  var SORT_OPT = [["new", "Newest first"], ["soon", "Closing date (soonest first)"], ["value", "Value (biggest first)"]];
  var SELECTS = { close: "Status", posted: "Published", value: "Bid value", aside: "Who can bid", reg: "Registration" };
  var OPTS = { close: CLOSE_OPT, posted: POSTED_OPT, value: VALUE_OPT, aside: ASIDE_OPT, reg: REG_OPT, sort: SORT_OPT };

  function passes(r, ctx) {
    var i;
    for (i = 0; i < ctx.words.length; i++) if (r.hay.indexOf(ctx.words[i]) < 0) return false;
    if (ctx.cats.length) { var h = hits(r), ok = false; for (i = 0; i < ctx.cats.length; i++) if (h[ctx.cats[i]]) { ok = true; break; } if (!ok) return false; }
    if (st.level.length && st.level.indexOf(r.level) < 0) return false;
    if (st.where.length && st.where.indexOf(r.code) < 0) return false;
    if (st.close === "none") { if (r.days != null) return false; }
    else if (st.close !== "any" && (r.days == null || r.days > +st.close)) return false;
    if (st.posted !== "any" && (!r.posted || (today - new Date(r.posted.slice(0, 10) + "T00:00:00")) / DAY > +st.posted)) return false;
    var v = r.value;
    if (st.value === "stated" && v == null) return false;
    if (st.value === "under50" && !(v != null && v < 50000)) return false;
    if (st.value === "mid" && !(v != null && v >= 50000 && v <= 500000)) return false;
    if (st.value === "over500" && !(v != null && v > 500000)) return false;
    if (st.aside === "open" ? r.aside.any : st.aside !== "any" && !r.aside[st.aside]) return false;
    if (st.reg === "yes") { var info = window.RFQProfile && window.RFQProfile.regInfo(window.RFQProfile.sourceFor(r.level, r.code)); if (!info || !info.registered) return false; }
    return true;
  }
  function ctxNow() { return { words: st.kw.toLowerCase().split(/\s+/).filter(Boolean), cats: selCats() }; }

  function resetFilters(keepCats) { st.kw = ""; st.cats = keepCats ? null : []; st.level = []; st.where = []; st.close = "any"; st.posted = "any"; st.value = "any"; st.aside = "any"; st.reg = "any"; st.shown = PAGE; }
  function lab(key, v) { return OPTS[key].filter(function (o) { return o[0] === v; })[0][1]; }
  function chipList() { // every active filter, shown as a removable chip under the filter row
    var out = [], cats = selCats(), cl = allCats();
    if (st.kw.trim()) out.push(["kw", "“" + st.kw.trim() + "”"]);
    if (cats.length) out.push(["cats", "Category: " + (cats.length === 1 ? (cl.filter(function (c) { return c.id === cats[0]; })[0] || {}).label : st.cats === null ? "my products (" + cats.length + ")" : cats.length + " selected")]);
    if (st.level.length) out.push(["level", st.level.join(", ")]);
    if (st.where.length) out.push(["where", st.where.length === 1 ? stateName(st.where[0]) : st.where.length + " locations"]);
    ["close", "posted", "value", "aside", "reg"].forEach(function (k) { if (st[k] !== "any") out.push([k, (k === "close" ? "" : SELECTS[k] + ": ") + lab(k, st[k])]); });
    return out;
  }

  // ---------- filter row ----------
  var ICON_SEARCH = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  var ICON_X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  var ICON_CAL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h.01"/></svg>';
  var ICON_CLOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  function selectHtml(key) {
    return '<div class="hm-field"><select data-sel="' + key + '" aria-label="' + SELECTS[key] + '" class="' + (st[key] !== "any" ? "on" : "") + '">' +
      OPTS[key].map(function (o) { return '<option value="' + o[0] + '"' + (st[key] === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
  }
  function ddText(label, opts, sel) {
    return !sel.length ? label : label + ": " + (sel.length === 1 ? (opts.filter(function (o) { return o.v === sel[0]; })[0] || { label: "1" }).label : sel.length);
  }
  // Multi-select dropdown. Nothing ticked = no filter (any).
  function ddHtml(key, label, opts, sel, topLinks, cls) {
    var list = "", grp = null;
    opts.forEach(function (o) {
      if (o.group && o.group !== grp) { grp = o.group; list += '<div class="hm-grp">' + esc(grp) + "</div>"; }
      list += '<label class="hm-opt"><input type="checkbox" data-ms="' + key + '" value="' + esc(o.v) + '"' + (sel.indexOf(o.v) >= 0 ? " checked" : "") + "><span>" + esc(o.label) + "</span>" + (o.n != null ? "<em>" + o.n + "</em>" : "") + "</label>";
    });
    return '<div class="hm-field dd ' + (cls || "") + (st.dd === key ? " open" : "") + '" data-k="' + key + '">' +
      '<button type="button" class="hm-dd-btn' + (sel.length ? " on" : "") + '" data-dd="' + key + '" aria-haspopup="listbox"><span data-lbl>' + esc(ddText(label, opts, sel)) + "</span></button>" +
      '<div class="hm-dd-panel"><div class="hm-dd-top">' + topLinks + '</div><div class="hm-dd-list">' + list + "</div></div></div>";
  }
  function levelOpts() { return LEVEL_OPT.map(function (l) { return { v: l, label: l, n: rows.filter(function (r) { return r.level === l; }).length }; }); }
  function catOpts() { return allCats().map(function (c) { return { v: c.id, label: c.label, n: rows.filter(function (r) { return hits(r)[c.id]; }).length }; }); }
  function whereOpts() {
    var n = {}; rows.forEach(function (r) { n[r.code] = (n[r.code] || 0) + 1; });
    var out = [];
    ["US", "NYC"].forEach(function (c) { if (n[c]) out.push({ v: c, label: stateName(c), n: n[c], group: c === "US" ? "Federal" : "City" }); });
    Object.keys(n).filter(function (c) { return c !== "US" && c !== "NYC"; }).sort(function (a, b) { return stateName(a).localeCompare(stateName(b)); })
      .forEach(function (c) { out.push({ v: c, label: stateName(c), n: n[c], group: "States" }); });
    return out;
  }
  var MORE_KEYS = ["value", "aside", "reg"];
  function fieldsHtml() {
    var moreOn = st.more || MORE_KEYS.some(function (k) { return st[k] !== "any"; });
    return ddHtml("level", "Agency Type", levelOpts(), st.level, '<button type="button" data-a="level-none">Clear</button>') +
      ddHtml("cats", "Category", catOpts(), selCats(), '<button type="button" data-a="cats-all">Select all</button><button type="button" data-a="cats-none">Clear</button><button type="button" data-a="cats-mine">Reset to my products</button>') +
      ddHtml("where", "Location", whereOpts(), st.where, '<button type="button" data-a="where-none">Clear</button>', "") +
      selectHtml("posted") + selectHtml("close") +
      (moreOn ? "" : "");
  }
  function moreHtml() {
    var on = st.more || MORE_KEYS.some(function (k) { return st[k] !== "any"; });
    return '<button type="button" class="hm-tog" data-a="more-filters">' + (on ? "Fewer filters" : "More filters (bid value, who can bid, registration)") + "</button>" +
      (on ? '<div class="hm-morerow">' + MORE_KEYS.map(selectHtml).join("") + "</div>" : "");
  }

  // ---------- page ----------
  function shell() {
    var prof = P();
    $app.innerHTML = '<div class="hm"><div class="hm-nav"><div class="hm-in"><span class="hm-logo">Bid<i>.</i>Finder</span>' +
      '<button class="hm-btn" data-a="profile">' + (prof ? "Edit my profile" : "Set up my profile") + '</button><button class="hm-btn" data-a="refresh">Refresh</button></div></div>' +
      '<div class="hm-in"><div class="hm-title"><h1>View Open Bids &amp; RFQs</h1><p id="hm-stats"></p></div>' +
      '<form class="hm-bar" data-form><label class="hm-kw"><input type="search" data-kw placeholder="Search by keyword or bid title" aria-label="Keyword" value="' + esc(st.kw) + '">' + ICON_SEARCH + '</label><div class="hm-fields" id="hm-fields"></div></form>' +
      '<div id="hm-more"></div><div id="hm-res"></div></div></div>';
    fields();
  }
  function fields() {
    var el = document.getElementById("hm-fields"); if (!el) return;
    var old = el.querySelector(".hm-field.open .hm-dd-list"), top = old ? old.scrollTop : 0;
    el.innerHTML = fieldsHtml();
    // right-align the last two dropdown panels so they stay on screen
    var dds = el.querySelectorAll(".hm-field.dd"); if (dds.length) dds[dds.length - 1].classList.add("rt");
    var nl = el.querySelector(".hm-field.open .hm-dd-list"); if (nl) nl.scrollTop = top;
    var m = document.getElementById("hm-more"); if (m) m.innerHTML = moreHtml();
  }

  function regBlock(r) {
    var RP = window.RFQProfile, info = RP && RP.regInfo && RP.regInfo(RP.sourceFor(r.level, r.code));
    if (!info || info.registered) return "";
    var open = st.regOpen[info.id];
    return '<div class="hm-reg"><b>Registration needed:</b> ' + esc(info.reg) + ' <button class="hm-more" data-r="' + info.id + '" data-v="1">I am registered</button>' +
      '<button class="hm-more" data-ro="' + info.id + '">' + (open ? "Hide how" : "How to register") + "</button>" +
      (open ? "<ol>" + info.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        (info.url ? '<a href="' + esc(info.url) + '" target="_blank" rel="noopener">Open the registration page &rarr;</a>' : "") : "") + "</div>";
  }

  function results() {
    var host = document.getElementById("hm-res"); if (!host) return;
    var ctx = ctxNow(), catLabel = {}; allCats().forEach(function (c) { catLabel[c.id] = c.label; });
    var list = rows.filter(function (r) { return passes(r, ctx); });
    list.sort(function (a, b) {
      if (st.sort === "value") return (b.value == null ? -1 : b.value) - (a.value == null ? -1 : a.value);
      if (st.sort === "new") return String(b.seen || "").localeCompare(String(a.seen || ""));
      return (a.days == null ? 9e9 : a.days) - (b.days == null ? 9e9 : b.days);
    });
    var chips = chipList();
    var h = '<div class="hm-filt">' + (chips.length ? "<b>Filtered by</b>" + chips.map(function (c) { return '<button class="hm-chip" data-x="' + c[0] + '" title="Remove this filter">' + esc(c[1]) + ICON_X + "</button>"; }).join("") + '<button class="hm-clear" data-a="clear">Clear All</button>' : "") + "</div>";
    h += '<div class="hm-resbar"><span class="hm-cnt">' + list.length.toLocaleString() + (list.length === 1 ? " result" : " results") + '</span><label for="hm-sort">Order By</label><select id="hm-sort" data-sel="sort">' +
      SORT_OPT.map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
    if (!list.length) h += '<div class="hm-empty"><h3>No bids match these filters</h3><p class="hm-sub">Try widening the category, location or deadline.</p><button class="hm-go" data-a="clear">Clear all filters</button></div>';
    h += '<div class="hm-list">';
    list.slice(0, st.shown).forEach(function (r) {
      var hh = hits(r), ids = Object.keys(hh).filter(function (id) { return ctx.cats.length ? ctx.cats.indexOf(id) >= 0 : true; });
      var matchTag = ids.length ? '<span class="hm-tag match" title="' + esc(ids.map(function (id) { return hh[id].slice(0, 3).join(", "); }).join("; ")) + '">' + esc(ids.slice(0, 2).map(function (id) { return catLabel[id]; }).join(" · ")) + (ids.length > 2 ? " +" + (ids.length - 2) : "") + "</span>" : "";
      var asideTag = r.aside.any ? '<span class="hm-tag aside">' + esc(r.aside.small ? "Small business set-aside" : r.aside.vet ? "Veteran-owned set-aside" : r.aside.women ? "Women-owned set-aside" : "Set-aside") + "</span>" : "";
      var closing = r.days == null ? "No firm deadline" : mdy(r.due) + (r.days <= 7 ? " (" + (r.days === 0 ? "today" : r.days + (r.days === 1 ? " day" : " days")) + ")" : "");
      h += '<div class="hm-item"><div class="hm-ic ' + esc(r.level) + '" title="' + esc(stateName(r.code)) + '">' + esc(r.code) + "</div><div><h3><a href=\"/explore.html?id=" + encodeURIComponent(r.id) + '">' + esc(r.title) + "</a></h3>" +
        '<div class="hm-sub">' + esc(stateName(r.code)) + (r.agency ? " · " + esc(r.agency) : "") + (r.region ? " · " + esc(r.region) : "") + "</div>" +
        ((r.value || asideTag || matchTag) ? '<div class="hm-tags">' + (r.value ? '<span class="hm-tag">' + esc(money(r.value)) + "</span>" : "") + asideTag + matchTag + "</div>" : "") + "</div>" +
        '<div class="hm-dates"><div>' + ICON_CAL + "<b>Published</b></div><div>" + esc(r.posted ? mdy(r.posted) : "Unknown") + "</div><div>" + ICON_CLOCK + "<b>Closing</b></div><div" + (r.days != null && r.days <= 7 ? ' class="soon"' : "") + ">" + esc(closing) + "</div></div>" +
        regBlock(r) + "</div>";
    });
    h += "</div>";
    if (list.length > st.shown) h += '<button class="hm-showmore" data-a="more">Show more (' + (list.length - st.shown).toLocaleString() + " left)</button>";
    host.innerHTML = h;
  }

  function stats() {
    var el = document.getElementById("hm-stats"); if (!el) return;
    var soon = rows.filter(function (r) { return r.days != null && r.days <= 14; }).length, codes = {}; rows.forEach(function (r) { codes[r.code] = 1; });
    el.textContent = rows.length.toLocaleString() + " open bids from " + Object.keys(codes).length + " jurisdictions · " + soon.toLocaleString() + " closing within 2 weeks";
  }

  function render() {
    if (!window.RFQS) return;
    if (!rows) prep();
    shell(); stats(); results();
  }
  function refreshAll() { fields(); results(); }

  // ---------- events ----------
  function syncOpen() { Array.prototype.forEach.call($app.querySelectorAll(".hm-field.dd"), function (f) { f.classList.toggle("open", f.dataset.k === st.dd); }); }
  document.addEventListener("click", function (e) { if (st.dd && !e.target.closest(".hm-field.dd")) { st.dd = null; syncOpen(); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && st.dd) { st.dd = null; syncOpen(); } });
  function clearKw() { var k = $app.querySelector("[data-kw]"); if (k) k.value = ""; }

  $app.addEventListener("click", function (e) {
    var dd = e.target.closest("[data-dd]");
    if (dd) { st.dd = st.dd === dd.dataset.dd ? null : dd.dataset.dd; return syncOpen(); }
    var x = e.target.closest("[data-x]");
    if (x) {
      var k = x.dataset.x;
      if (k === "kw") { st.kw = ""; clearKw(); } else if (k === "cats") st.cats = []; else if (k === "level" || k === "where") st[k] = []; else st[k] = "any";
      st.shown = PAGE; return refreshAll();
    }
    var b = e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    if (d.a === "profile") return window.RFQProfile.open();
    if (d.a === "refresh") { var rb = document.getElementById("refreshBtn"); if (rb) rb.click(); b.textContent = "Refreshing…"; return; }
    if (d.a === "clear") { resetFilters(false); clearKw(); return refreshAll(); }
    if (d.a === "more-filters") { st.more = !(st.more || MORE_KEYS.some(function (k) { return st[k] !== "any"; })); if (!st.more) { MORE_KEYS.forEach(function (k) { st[k] = "any"; }); } return refreshAll(); }
    if (d.a === "cats-all") st.cats = allCats().map(function (c) { return c.id; });
    else if (d.a === "cats-none") st.cats = [];
    else if (d.a === "cats-mine") st.cats = null;
    else if (d.a === "where-none") st.where = [];
    else if (d.a === "level-none") st.level = [];
    else if (d.a === "more") { st.shown += PAGE; return results(); }
    else if (d.ro) { st.regOpen[d.ro] = !st.regOpen[d.ro]; return results(); }
    else if (d.r) { window.RFQProfile.setReg(d.r, d.v === "1"); return results(); }
    else return;
    st.shown = PAGE; refreshAll();
  });
  $app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.sel) { st[t.dataset.sel] = t.value; st.shown = PAGE; t.classList.toggle("on", t.value !== "any" && t.dataset.sel !== "sort"); return results(); }
    if (t.dataset.ms) {
      var key = t.dataset.ms, ids = Array.prototype.slice.call($app.querySelectorAll('input[data-ms="' + key + '"]')).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      if (key === "cats") st.cats = ids; else st[key] = ids;
      var cfg = { cats: ["Category", catOpts], where: ["Location", whereOpts], level: ["Agency Type", levelOpts] }[key], lbl = $app.querySelector('.hm-field[data-k="' + key + '"] [data-lbl]');
      if (lbl) { lbl.textContent = ddText(cfg[0], cfg[1](), ids); lbl.parentNode.classList.toggle("on", ids.length > 0); }
      st.shown = PAGE; results();
    }
  });
  var kwTimer = null;
  $app.addEventListener("input", function (e) { if (e.target.dataset.kw != null) { st.kw = e.target.value; st.shown = PAGE; clearTimeout(kwTimer); kwTimer = setTimeout(results, 150); } });
  $app.addEventListener("submit", function (e) { e.preventDefault(); st.dd = null; syncOpen(); results(); });
  window.addEventListener("rfqprofilechange", function () { st.cats = null; render(); });
  window.addEventListener("rfqwizardclose", render);
  render();
})();
