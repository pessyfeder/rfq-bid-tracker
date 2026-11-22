// Main screen: a search page in the style of a bid portal. Title, one row of filters (keyword, Category, Jurisdiction,
// Published, Status), "Filtered by" chips, then a results bar and a list of bids with Published / Closing dates.
// Category starts out selected to the products from the setup wizard (pre-filled from the vendor's website).
// The original full table still exists in index.html as a hidden data layer and is never shown.
(function () {
  var $app = document.getElementById("app");
  if (!$app) return;
  var DAY = 86400000, PAGE = 25;
  var st = { view: (function () { try { return localStorage.getItem("rfq-view") === "grid" ? "grid" : "list"; } catch (e) { return "list"; } })(), kw: "", cats: [], where: [], close: [], posted: [], value: [], vmin: "", vmax: "", aside: [], sort: "new", shown: PAGE, dd: null, more: false, openG: { "My products": true } };

  var css = document.createElement("style");
  css.textContent =
    "body{background:#fff;margin:0}" +
    ".hm{font:13px/1.45 Roboto,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f3347}.hm *{box-sizing:border-box}.hm button,.hm select,.hm input{font:inherit}.hm button{cursor:pointer}" +
    ".hm-in{max-width:980px;margin:0 auto;padding:0 24px}" +
    ".hm-nav{border-bottom:1px solid #e3e8ef;background:#fff}.hm-nav .hm-in{display:flex;align-items:center;gap:10px;height:46px}.hm-logo{font-weight:800;font-size:17px;letter-spacing:-.02em;color:#312e81;margin-right:auto}.hm-logo i{font-style:normal;color:#f59e0b}" +
    ".hm-btn{border:1px solid #4338ca;background:#fff;color:#4338ca;border-radius:6px;padding:5px 12px;font-weight:600;font-size:13px}.hm-btn:hover{background:#eef0ff}" +
    ".hm-title{text-align:center;padding:24px 0 6px}.hm-title h1{margin:0;font-size:26px;font-weight:600;color:#1f3a56;letter-spacing:-.01em}.hm-title p{margin:4px 0 0;color:#64748b;font-size:12.5px}" +
    /* filter row */
    ".hm-bar{flex-wrap:nowrap;width:min(1500px,calc(100vw - 32px));position:relative;left:50%;transform:translateX(-50%)}.hm-kw{flex:0 0 140px!important;min-width:0}.hm-fields{flex:1 1 0!important;flex-wrap:nowrap}.hm-field{flex:1 1 0!important;min-width:112px}.hm-field select,.hm-dd-btn{text-overflow:clip}" +
    ".hm-bar{display:flex;align-items:center;gap:6px;margin-top:14px;background:#f5f5ff;border:1px solid #e3e8ef;border-radius:8px;padding:6px}.hm-kw{display:flex;align-items:center;gap:8px;border:1px solid #d3dbe4;border-radius:5px;padding:0 10px;background:#fff;height:38px;flex:1 1 210px;min-width:150px}.hm-kw:focus-within{border-color:#4338ca;box-shadow:0 0 0 3px #4338ca22}" +
    ".hm-kw input{flex:1;min-width:0;border:0;outline:0;font-size:13px;color:#1f3a56;background:transparent;height:100%}.hm-kw input::placeholder{color:#7b8a9a}.hm-kw svg{flex:none;color:#4338ca}" +
    ".hm-fields{display:flex;flex:2.4 1 0;min-width:0;gap:6px}.hm-field{position:relative;min-width:0;flex:1 1 0}.hm-lb{position:absolute;z-index:1;top:4px;left:9px;right:6px;pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;line-height:1;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b}" +
    ".hm-field select,.hm-dd-btn{width:100%;height:38px;border:1px solid #d3dbe4;border-radius:5px;background:#fff;color:#2d4256;font-weight:500;font-size:12px;padding:13px 22px 0 8px;text-align:left;appearance:none;-webkit-appearance:none}" +
    ".hm-field select{background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%232d4256' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 9l7 7 7-7'/%3E%3C/svg%3E\") no-repeat right 6px center}" +
    ".hm-dd-btn{display:block;position:relative}.hm-dd-btn span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hm-dd-btn:after{content:'';position:absolute;right:10px;top:50%;width:5px;height:5px;border-right:2px solid #2d4256;border-bottom:2px solid #2d4256;transform:translateY(-70%) rotate(45deg)}" +
    ".hm-field:not(:has(.on)) .hm-lb{display:none}.hm-field:not(:has(.on)) select,.hm-field:not(:has(.on)) .hm-dd-btn{padding-top:0;font-size:13px;color:#2d4256}.hm-field:not(:has(.on)) .hm-dd-btn span{line-height:36px}" +
    ".hm-field select:focus,.hm-dd-btn:focus{outline:2px solid #4338ca55;border-color:#4338ca}.hm-field.open .hm-dd-btn,.hm-dd-btn.on,.hm-field select.on{border-color:#1e3a8a;color:#1e3a8a}.hm-dd-btn.on,.hm-field select.on{box-shadow:inset 0 0 0 1px #1e3a8a}" +
    /* filter row scaled to 75% */
    ".hm-bar{gap:4px;padding:4px;margin-top:10px;border-radius:6px}.hm-kw{flex-basis:105px!important;height:29px;gap:6px;padding:0 8px}.hm-kw input{font-size:10px}.hm-kw svg{width:13px;height:13px}.hm-fields{gap:4px}.hm-field{min-width:84px}.hm-lb{top:3px;left:7px;right:5px;font-size:7px}" +
    ".hm-field select,.hm-dd-btn{height:29px;font-size:9px;padding:10px 17px 0 6px;background-size:10px 10px}.hm-field select{background-position:right 5px center}.hm-field:not(:has(.on)) select,.hm-field:not(:has(.on)) .hm-dd-btn{font-size:10px}.hm-field:not(:has(.on)) .hm-dd-btn span{line-height:27px}.hm-dd-btn:after{right:8px;width:4px;height:4px}" +
    /* search box sits above the filters, right-aligned, just wide enough for its placeholder */
    ".hm-bar{flex-direction:column;align-items:stretch;gap:4px}.hm-kw{flex:0 0 auto!important;align-self:flex-end;width:220px;min-width:0}.hm-fields{flex:0 0 auto!important;width:100%}" +
    ".hm-dd-panel{display:none;position:absolute;z-index:30;left:0;top:100%;margin-top:4px;min-width:100%;width:340px;max-width:92vw;background:#fff;border:1px solid #c5cdd8;border-radius:6px;box-shadow:0 10px 30px rgba(15,23,42,.2)}" +
    ".hm-field.open .hm-dd-panel{display:block}.hm-field.rt .hm-dd-panel{left:auto;right:0}" +
    ".hm-dd-top{display:flex;gap:14px;flex-wrap:wrap;padding:7px 12px;border-bottom:1px solid #e5e9f0;font-size:12px}.hm-dd-top button{border:0;background:none;color:#4338ca;text-decoration:underline;font-weight:500;padding:0}" +
    ".hm-dd-list{max-height:320px;overflow:auto;padding:4px 0}.hm-grp{padding:6px 12px 2px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}" +
    ".hm-gh{display:flex;align-items:center;gap:8px;padding:5px 12px;border-bottom:1px solid #eef1f5}.hm-gh input{width:16px;height:16px;accent-color:#4338ca;flex:none;margin:0}.hm-gt{flex:1;cursor:pointer;font-weight:600;font-size:13px;color:#1f2937}.hm-gt em{font-style:normal;font-weight:400;font-size:12px;color:#64748b;margin-left:6px}.hm-arr{display:inline-block;width:14px;color:#64748b}.hm-kids{padding-left:16px}.hm-kids[hidden]{display:none}" +
    ".hm-opt{display:flex;gap:10px;align-items:center;padding:4px 12px;cursor:pointer;color:#1f3347;margin:0;font-size:13px}.hm-opt:hover{background:#eef0ff}.hm-opt input{width:16px;height:16px;accent-color:#4338ca;flex:none;margin:0}.hm-opt span{flex:1;min-width:0}.hm-opt em{font-style:normal;color:#94a3b8;font-size:12px}" +
    ".hm-morerow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}.hm-morerow .hm-field{flex:none}" +
    ".hm-tog{border:0;background:none;color:#4338ca;font-weight:600;text-decoration:underline;padding:10px 0 0}" +
    /* filtered by */
    ".hm-filt{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 0;min-height:34px}.hm-filt b{font-weight:600;color:#1f3a56}" +
    ".hm-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #d3dbe4;background:#f4f6f9;color:#1f3a56;font-weight:600;border-radius:999px;padding:5px 9px 5px 12px;font-size:13px}.hm-chip:hover{background:#eaeff5}.hm-chip svg{color:#7b8a9a}" +
    ".hm-clear{border:0;background:none;color:#4338ca;font-weight:600;padding:4px;font-size:13px}.hm-clear:hover{text-decoration:underline}" +
    /* results */
    ".hm-resbar,.hm-list{max-width:980px;margin-left:auto;margin-right:auto}.hm-resbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#312e81;color:#fff;margin-top:12px;padding:0 14px;height:44px;font-weight:500;font-size:13px}.hm-resbar .hm-cnt{margin-right:auto}" +
    ".hm-resbar select{height:30px;min-width:190px;max-width:100%;border:0;border-radius:4px;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%232d4256' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M5 9l7 7 7-7'/%3E%3C/svg%3E\") no-repeat right 10px center;color:#555f6b;padding:0 30px 0 10px;font-size:13px;appearance:none;-webkit-appearance:none}" +
    ".hm-list{border:1px solid #e1e5ea;border-top:0;margin-bottom:12px}.hm-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 14px;align-items:center;padding:6px 16px 6px 14px;min-height:56px;border-bottom:1px solid #dfe3e8;background:#fff}.hm-item:nth-child(even){background:#f8faf9}.hm-item:last-child{border-bottom:0}" +
    ".hm-ic{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#6b7683;color:#fff}.hm-ic svg{width:15px;height:15px}" +
    ".hm-item h3{margin:0;font-size:13.5px;font-weight:500;line-height:1.3}.hm-item h3 a{color:#1d2b3a;text-decoration:none}.hm-item h3 a:hover{text-decoration:underline}.hm-val{color:#1b7a34;font-weight:700;margin-left:6px;white-space:nowrap}.hm-val.none{font-weight:400}.hm-sub{color:#6b7280;font-size:12px;margin-top:1px}" +
    ".hm-dates{display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:12px;align-content:center;min-width:170px;color:#2a3644}.hm-dates div{display:flex;align-items:center;gap:7px}.hm-dates svg{color:#7b8794;flex:none;width:15px;height:15px}.hm-dates b{font-weight:600}.hm-dates .hm-left{color:#c62828;font-weight:600;white-space:nowrap}" +
    ".hm-more{border:0;background:none;color:#4338ca;font-weight:500;text-decoration:underline;padding:2px 8px}" +
    ".hm-go{display:inline-block;background:#4338ca;color:#fff;border:0;border-radius:6px;padding:6px 12px;font-weight:500;font-size:13px}" +
    ".hm-empty{text-align:center;padding:48px 16px;border:1px solid #d9dfe7;border-top:0}.hm-empty h3{margin:0 0 6px}" +
    ".hm-showmore{display:block;margin:14px auto 60px;border:1px solid #4338ca;background:#fff;color:#4338ca;border-radius:6px;padding:7px 22px;font-weight:600;font-size:13px}" +
    ".hm-resbar{border-radius:12px 12px 0 0;background:linear-gradient(90deg,#312e81,#4338ca)}.hm-list{border:0;background:transparent;padding:10px 0 0;display:flex;flex-direction:column;gap:8px}" +
    ".hm-item{grid-template-columns:auto minmax(0,1fr) auto}.hm-map{display:flex;align-items:center;justify-content:center}.hm-item,.hm-item:nth-child(even){background:#fff;border:1px solid #e4e4f0;border-left:4px solid #4338ca;border-radius:10px;box-shadow:0 1px 2px rgba(49,46,129,.06);padding:10px 16px 10px 12px;min-height:60px}.hm-item:hover{box-shadow:0 4px 12px rgba(49,46,129,.12)}.hm-item:last-child{border-bottom:1px solid #e4e4f0}" +
    ".hm-ic{width:auto;height:auto;min-height:40px;padding:6px 8px;border-radius:8px;background:#eef0ff;color:#4338ca;font-size:11px;font-weight:600;line-height:1.2;text-align:center;overflow-wrap:anywhere}.hm-item h3{font-weight:600;font-size:14px}.hm-item h3 a{color:#27264f}" +
    ".hm-bar{position:relative}.hm-view{position:absolute;right:0;top:0;display:inline-flex;height:30px;border:1px solid #d9dee5;border-radius:999px;overflow:hidden;background:#fff}.hm-vb{display:flex;align-items:center;justify-content:center;width:40px;border:0;background:#fff;color:#7b8794;padding:0}.hm-vb.on{background:#1b2540;color:#fff}" +
    ".hm-list.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hm-list.grid .hm-item{grid-template-columns:minmax(0,1fr);align-content:start}.hm-list.grid .hm-map{display:none}.hm-list.grid .hm-dates{grid-column:1;min-width:0;justify-content:start}" +
    ".hm-title h1{font-weight:700;letter-spacing:-.02em}.hm-showmore,.hm-btn,.hm-go{border-radius:999px}.hm-chip{background:#eef0ff;border-color:#c7caf5}" +
    /* portal layout: one flat row, wide search box with icon at right, then white bordered dropdowns; chips row below */
    ".hm-bar{flex-direction:row;align-items:center;gap:8px;background:none;border:0;padding:0;margin-top:16px;border-radius:0;width:min(1100px,calc(100vw - 32px))}" +
    ".hm-kw{flex:1 1 200px!important;align-self:center;width:auto;min-width:160px;height:36px;gap:8px;padding:0 12px;border:1px solid #d9dee5;border-radius:2px}.hm-kw input{font-size:13px;color:#1f3347}.hm-kw input::placeholder{color:#6b7684}.hm-kw svg{width:16px;height:16px;color:#0e5a73;order:2}.hm-kw:focus-within{border-color:#0e5a73;box-shadow:none}" +
    ".hm-fields{flex:0 0 auto!important;width:auto;gap:8px}.hm-field{flex:0 0 auto!important;min-width:0}.hm-lb{display:none!important}" +
    ".hm-field select,.hm-dd-btn,.hm-field:not(:has(.on)) select,.hm-field:not(:has(.on)) .hm-dd-btn{width:auto;height:35px;border:1px solid #d9dee5;border-radius:2px;font-size:13px;font-weight:500;color:#4a5562;padding:0 26px 0 11px;background-size:12px 12px;background-position:right 8px center;text-overflow:clip;white-space:nowrap}.hm-field .hm-dd-btn span,.hm-field:not(:has(.on)) .hm-dd-btn span{line-height:33px;overflow:visible;text-overflow:clip}" +
    ".hm-dd-btn:after{right:11px;width:5px;height:5px;border-color:#2d3a48}.hm-field.open .hm-dd-btn,.hm-dd-btn.on,.hm-field select.on{border-color:#0e5a73;color:#0e5a73;box-shadow:none}" +
    /* every filter box the same width, wide enough for the longest selected label ("Open to all (no set-aside found)") */
    ".hm-fields{flex-wrap:wrap}.hm-field{width:262px}.hm-field select,.hm-dd-btn,.hm-field:not(:has(.on)) select,.hm-field:not(:has(.on)) .hm-dd-btn{width:100%}" +
    ".hm-filt{margin:12px 0 0;gap:8px;min-height:0;width:min(1100px,calc(100vw - 32px));position:relative;left:50%;transform:translateX(-50%)}" +
    ".hm-filt b{font-size:13px;color:#2d3a48;font-weight:600}.hm-chip{background:#f4f5f9;border:1px solid #cfd5de;color:#2d3a48;font-size:13px;padding:4px 7px 4px 11px}.hm-chip svg{width:16px;height:16px;color:#7b8794}.hm-clear{color:#0e5a73;font-size:13px;font-weight:600}" +
    /* final: filters line up with the results table (same 980px column); search on top-left at half width; smaller controls */
    ".hm-bar,.hm-filt{width:auto;max-width:980px;margin-left:auto;margin-right:auto;left:auto;transform:none;box-sizing:border-box}.hm-bar{flex-direction:column;align-items:stretch;gap:6px}" +
    ".hm-kw{flex:0 0 auto!important;align-self:flex-start;width:50%;min-width:0;height:30px;padding:0 9px;box-sizing:border-box}.hm-kw input{font-size:11.5px}.hm-kw svg{width:14px;height:14px}" +
    ".hm-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));width:100%;gap:6px;flex-wrap:nowrap}.hm-field{width:auto;min-width:0}" +
    ".hm-field select,.hm-dd-btn,.hm-field:not(:has(.on)) select,.hm-field:not(:has(.on)) .hm-dd-btn{height:30px;font-size:11.5px;padding:0 22px 0 8px;background-size:10px 10px;background-position:right 6px center;text-overflow:ellipsis;overflow:hidden}.hm-field .hm-dd-btn span,.hm-field:not(:has(.on)) .hm-dd-btn span{line-height:28px;overflow:hidden;text-overflow:ellipsis}.hm-dd-btn:after{right:9px;width:4px;height:4px}" +
    /* a set filter only gets a dark blue outline: the label text stays exactly as it was (the select's own text is hidden, a fixed label is drawn over it) */
    ".hm-cust{display:inline-flex;gap:6px}.hm-cust input{height:30px;width:92px;font-size:11.5px;padding:0 8px;border:1px solid #c5cdd8;border-radius:6px;box-shadow:inset 0 0 0 1px #0e5a73}" +
    ".hm-face{position:absolute;left:8px;right:22px;top:0;bottom:0;display:flex;align-items:center;pointer-events:none;font-size:11.5px;font-weight:500;color:#4a5562;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".hm-field select[data-sel]{color:transparent}.hm-field select[data-sel] option{color:#1f3347}" +
    ".hm-dd-btn.on,.hm-field select.on{color:#4a5562;box-shadow:inset 0 0 0 1px #0e5a73}.hm-dd-btn.on span{color:#4a5562}" +
    /* search box ends where the Jurisdiction filter ends: 2 of the 6 equal filter columns */
    "@media(min-width:1101px){.hm-fields{grid-template-columns:repeat(6,minmax(0,1fr))}.hm-kw{width:calc((100% - 30px) / 3 + 6px)}}" +
    "@media(max-width:1100px){.hm-bar{flex-wrap:wrap}.hm-kw{flex:1 1 100%!important;max-width:calc(100% - 100px)}.hm-fields{flex:1 1 100%!important;flex-wrap:wrap}.hm-field{flex:1 1 calc(25% - 6px)!important;min-width:110px}.hm-field.rt .hm-dd-panel{left:auto;right:0}.hm-item{grid-template-columns:minmax(0,1fr)}.hm-map{display:none}.hm-dates{grid-column:1;min-width:0;grid-template-columns:auto auto;justify-content:start}}" +
    "@media(max-width:620px){.hm-in{padding:0 14px}.hm-title h1{font-size:22px}.hm-fields{gap:6px}.hm-field{flex-basis:calc(50% - 6px)}.hm-dd-panel{width:92vw}.hm-field:nth-child(odd) .hm-dd-panel{left:0;right:auto}.hm-field:nth-child(even) .hm-dd-panel{left:auto;right:0}.hm-resbar select{min-width:0;width:100%}.hm-item{grid-template-columns:1fr;padding:9px 14px}.hm-ic{display:none}.hm-dates{grid-column:1}}";
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

  // Keyless fallback for rows with no AI headline: agencies paste whole notices into the title field. Drop the
  // deadline / contact tail, turn "X invites vendors to submit bids for Y" into "Y", and cut long text at a word.
  function shortTitle(orig, scope) {
    var t = String(orig || "").replace(/\s+/g, " ").trim();
    // a title cut off with "..." is completed from the scope text when that starts with the same words
    if (/(\.\.\.|…)$/.test(t) && scope) {
      var sc = String(scope).replace(/^[A-Z]{2,6} - RFx\.\s*/, "").replace(/\s+/g, " ").trim();
      if (sc.length > t.length && sc.toLowerCase().indexOf(t.slice(0, 40).toLowerCase()) === 0) t = sc.replace(/\s+\S*$/, "");
    }
    t = t.replace(/[\s\-:;,.(]*\b(quote deadline|bid deadline|proposals? (are )?due|bids? (are )?due|deadline|due date|submit (your )?(quotes?|bids?|proposals?)? ?to|contact|questions? (should be )?(directed )?to|e-?mail)\b[\s\S]*$/i, "");
    t = t.replace(/\S+@\S+/g, "").replace(/\s+/g, " ").trim();
    var m = /\b(?:bids?|quotes?|proposals?|responses?)\s+(?:for|on)\s+(?:the\s+)?(?:purchase and installation of|purchase of|provision of|supply of|installation of)?\s*(.{12,})$/i.exec(t);
    if (m && /\b(invites?|requests?|seeks?|solicits?)\b/i.test(t.slice(0, m.index))) t = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    t = t.replace(/(\.\.\.|…)\s*$/, "").trim();
    if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + "…";
    return t || String(orig || "");
  }

  // Final tidy for every headline (AI-written or rule-built):
  //  - never shows the buyer's own jurisdiction (state, "New York City", "City of X"): the row already has a location tag
  //  - drops solicitation numbers, status labels ("Bid Extension:", "*REBID*") and the "Not clear from the listing:" hedge
  //  - a notice / contact line or a bare code is replaced by what the description says is wanted, when it says
  function scopeHeadline(scope) {
    var s = String(scope || "").replace(/<[^>]+>/g, " ").replace(/^[A-Z]{2,6} - RFx\.\s*/, "").replace(/\s+/g, " ").trim();
    var m = /\b(?:seeks?|seeking|requests?|invites?|solicits?|will receive|anticipates?)\s+(?:sealed\s+|competitive\s+)?(?:bids?|proposals?|quotes?|quotations?|qualifications|responses?|applications?|purchasing)\s+(?:for|to|from[^,]{0,60}\bto)\s+(?:the\s+)?(?:purchase of|provide|furnish(?:ing)?)?\s*(.{12,}?)(?:[.;]|$)/i.exec(s);
    if (!m) m = /\b(?:plans?|intends?|proposes?)\s+(?:a\s+|an\s+|to\s+)?(?:sole[- ]source\s+)?(?:purchase of|to purchase|to buy|procurement of)\s+(.{8,}?)(?:,|[.;]|$)/i.exec(s);
    if (!m) return "";
    var t = m[1].replace(/\s+(until|by|no later than)\b[\s\S]*$/i, "").replace(/[,\s]+(?:funded|financed|paid|sponsored)$/i, "").trim();
    if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "") + "…";
    return t.length >= 12 ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  }
  // Applies to every headline (AI or rule-built), any level of government: drop state names / postal codes, county
  // names, solicitation / facility / project codes and fiscal-year tags, and turn leftover ALL-CAPS words into words.
  var KEEP_CAPS = /^(SDVOSB|HUBZONE|MWBE|USAFA|USCG|NAVFAC|NASA|AMTRAK|FEMA|USDA|NOAA|HVAC|IDIQ|COVID|OSHA|USACE|UNICOR|DODEA|WOSB|NNSA)$/;
  function stripNoise(t) {
    var N = window.STATE_NAMES || {}, abbr = [], names = ["District of Columbia", "Washington,? D.?C.?"];
    Object.keys(N).forEach(function (k) { if (/^[A-Z]{2}$/.test(k) && k !== "US") { abbr.push(k); names.push(String(N[k]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); } });
    var nm = names.join("|"), ab = abbr.join("|");
    function rx(re, f) { return new RegExp(re.source.replace("@NM@", nm).replace("@AB@", ab), f); }
    t = t.replace(/\b\w+_(?:solicitation|notice|rfq|rfp|ifb)\w*?_/gi, "")                       // 36C25627R0012_solicitation_notice_
      .replace(rx(/\s*(?:,|\bin\b|\bfor\b|\s[-–])\s*(?:the\s+)?(?:State of\s+)?(?:@NM@)\b(?=\s*[,;.)(]|\s*$)/, "gi"), "")
      .replace(rx(/\s*,?\s*\(?\b(?:@AB@)\b\)?\.?\s*$/, ""), "")
      .replace(rx(/,\s*(?:@AB@)\b(?=\s*[,;)])/, "g"), "")
      .replace(/\b(?:(?:in|for|of|at)\s+)?(?:the\s+)?County of [A-Z][\w.'-]*(?: [A-Z][\w.'-]*)?/g, "")
      .replace(/\b(?:[A-Z][\w.'-]*|[a-z]{3,})(?: [A-Z][\w.'-]*)?\s+County\b(?!\s+(?:Route|Road|Rd|Highway|Hwy|Line|Fair))/g, function (m) { return /^(?:the|in|for|of|at|and|a|an|by|to|each|every|any)\b/i.test(m) ? m : ""; })
      .replace(/[,\s]+\d{2,}(?:-\d+){2,}\s*$/, "")                                                      // trailing part / stock number: ", 01-24-3106"
      .replace(/\bTrk\s*:?\s*/g, "Track ").replace(/\bFOR\b/g, "for")
      .replace(/\bFY\s?'?\d{2,4}\b/gi, "").replace(/\bFiscal Year\s*\(FY\)\s*\d{2,4}\b/gi, "")
      .replace(/\b(\d)(?:st|nd|rd|th)?\s*QTR\b\.?/gi, function (m, d) { return ({ 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" })[d] + " quarter"; })
      .replace(/\bQTR\b\.?/gi, "quarter")
      .split(/(\s+)/).map(function (w) {
        var core = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
        if (!core || /^\s+$/.test(w)) return w;
        if (/^\d{5,}$/.test(core) || (/\d/.test(core) && /[A-Za-z]/.test(core) && core.length >= 5 && !/[a-z]{3,}/.test(core) && !/^\d+(st|nd|rd|th)$/i.test(core) && !/^\d+(lbs?|in|ft|mm|cm|kv|hp|gal|oz|kg|psi|gpm|amp|volt)$/i.test(core))) return "";
        return w;
      }).join("")
      .replace(/\b(?:Project|Proj\.?|Contract|Solicitation|Bid|No\.?|Number|#)\s*[A-Z0-9][\w-]*\d[\w-]*(?:\s+\d{1,4}\b)*/g, "")
      .replace(rx(/\s*,?\s*\(?\b(?:@AB@)\b\)?\.?\s*$/, ""), "")
      .replace(/[A-Z]{2,}(?:-[A-Z]{2,})+/g, function (w) { return w.charAt(0) + w.slice(1).toLowerCase(); })
      .replace(/[A-Za-z]{5,}/g, function (w, off, str) {   // ALL-CAPS words become words; acronyms (in brackets, no vowels, listed) stay
        if (w !== w.toUpperCase() || KEEP_CAPS.test(w) || !/[AEIOU]/.test(w) || /\([^)]*$/.test(str.slice(0, off))) return w;
        return w.charAt(0) + w.slice(1).toLowerCase();
      })
      .replace(/\b(?:FOR|AND|THE|OF|TO|IN|ON|AT|BY|WITH|FROM)\b(?=\s+\S)/g, function (w, off, str) { return off > 0 ? w.toLowerCase() : w; })
      .replace(/,(?=[A-Za-z])/g, ", ");
    return t.replace(/\s{2,}/g, " ").replace(/\s+([,.;:)])/g, "$1").replace(/\b(?:project|no\.?|number|solicitation|contract|facility|bldg|building)\s*#?\s*$/i, "").replace(/\(\s*\)/g, "").trim();
  }
  function cleanTitle(t, r, code) {
    var orig = t = String(t || "").replace(/\s+/g, " ").trim(), m;
    if (t.length > 8 && /[A-Z]/.test(t) && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(?:Of|For|And|The|To|In|On|At|By|With|From)\b(?=\s+\S)/g, function (w, off) { return off > 0 ? w.toLowerCase() : w; });
    t = t.replace(/^(?:invitation (?:for|to) bids?|invitation to quote|request for (?:quotes?|quotations?|proposals?|bids?)|notice of (?:intent to )?(?:bid|award))\s*[-–:]\s*(?=\S)/i, "");
    t = t.replace(/^not clear from the listing:\s*/i, "").replace(/^\*?\s*re-?bid\s*\*?[\s:–-]*/i, "")
      .replace(/^(?:\*[^*]{2,30}\*\s*[-:–]?\s*)+(?=\S)/, "")                                   // "*Fax Bid* ..." status labels
      .replace(/^(?:General\s+)?(?:RFP|RFQ|IFB|ITB|RFB|RFI)\s*#?\s*\d[\w-]*\s*[:–-]\s*(?=[A-Za-z])/i, "")   // "General RFP 5026: ..."
      .replace(/(?<=\S{4,}.{6,})\s+[-–]\s+[A-Z]{3,5}$/, "")                                       // trailing agency tag " - DOC"
      .replace(/(?<=[A-Za-z].{5,}),?\s+\d+(?:-\d+)+$/, "")                                        // trailing item code ", 01-20-0100"
      .replace(/^addendum\s+(?:no\.?\s*)?#?\d+\s*[-:–]?\s*(?=[A-Za-z]{3})/i, "")                 // "Addendum No 1Mainframe ..." (separator may be missing)
      .replace(/^(bid extension|correction|addendum( no\.? ?\d+)?|amendment|open-ended|cancell?ed|re-?issued?)\s*[-:–]\s*/i, "")
      .replace(/^(?:[^-–:|]{0,40}\|\s*)?(?:(?:m\/?wbe|sdvob|dbe|mbe|wbe)\b[\s|,\/&]*)+(?:and\s+)?(?:subcontractors?|suppliers?|[&\/]|and|\s)*(?:opportunit(?:y|ies)|solicitations?)\s*(?:for\s*)?[-–:]\s*(?=\S)/i, "")   // "MWBE | Sdvob Subcontractor & Supplier Opportunity - ..."
      .replace(/^(?:[A-Z\/&]+\s+)*(?:opportunity)\s*[-–]\s*/i, function (x) { return /m\/?wbe|sdvob|mwbe/i.test(x) ? "" : x; })
      .replace(/^(?:(?:attn:?|m\/?wbe|sdvob|opp|subcontractors|suppliers|&|\/|and)\s*)+(?:opportunit(?:y|ies)|solicitations?)?\s*(?:for\s*)?[-–:]\s*(?=\S)/i, function (x) { return /m\/?wbe|sdvob/i.test(x) ? "" : x; })
      // buyer named as a prefix: "NYS DEC - ...", "Albany Port District Commission - ..." (second pass also catches it after the label above)
      .replace(/^(?:(?:NYS|NYC)\s+[A-Z]{2,6}|[A-Z][\w.&']*(?: [A-Z][\w.&']*){0,5} (?:Commission|Authority|Department|Dept\.?|Agency|Bureau|Office|Port District|Thruway))\s+[-–]\s+(?=[A-Za-z]{3}.{8,})/, "");
    var dash = /^(.{3,45}?)\s*[-–:]\s+(?=\S)/.exec(t);
    // a label made only of codes and solicitation words ("IFB 26-083 -", "Smd_a&cm_ rfq's 523158 -"), never real words ("FY 27 Tree Removal -")
    if (dash && /[A-Za-z]/.test(dash[1]) && /[\d_#]/.test(dash[1]) && t.length - dash[0].length >= 8 &&
        dash[1].split(/\s+/).every(function (w) { return /[\d_#]/.test(w) || /^(bid|rfp|rfq|rfb|ifb|itb|rfi|project|no\.?|number|pin|fy|&)('?s)?$/i.test(w) || /^[A-Z&\/]{2,6}('S)?$/.test(w); })) t = t.slice(dash[0].length);
    t = t.replace(/^(RFP|RFQ|IFB|ITB|RFB|RFI|ITN)\s*[-–:]\s*(?=[A-Za-z])/i, "").replace(/\s*[-–]\s*addendum\s*\d*\s*$/i, "");
    t = t.replace(/^(?:RFP|RFQ|IFB|ITB|RFB|RFI|ITN|ARFQ|CRFQ|PB)\b[\s#:.-]*[A-Za-z0-9][\w\/.-]*\d[\w\/.-]*[\s:–-]+(?=[A-Za-z])/i, "");
    t = t.replace(/^(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,}\s*[-:–]?\s+(?=[A-Za-z])/, "");
    var words = (t.match(/\b[A-Za-z]{3,}\b/g) || []).length;
    var boiler = /^(notice\b|submit to\b|email\b|sealed (bids|proposals)\b|written sealed\b|notice of (proposed|intent|sole)|the .{3,70}?\b(will receive|requests|invites|anticipates|is (hereby )?seeking)\b)/i.test(t) ||
      /^[A-Z][^.]{3,90}?\b(is|are) (hereby )?(soliciting|seeking|requesting|inviting|accepting)\b/.test(t) || /\bnotice of (proposed|intent)\b/i.test(t);
    var rq = /^[A-Z][^.]{3,90}?\b(?:requests?|invites?|seeks?|solicits?)\s+(?:sealed\s+)?(?:bids?|quotes?|proposals?|quotations?)\s+(?:for|on)\s+(?:the\s+)?(?:purchase of\s+)?(.{12,})$/.exec(t);
    if (rq) {   // "KDMC requests quotes for 53 new computers ... KDM..." -> what is wanted
      boiler = false;
      t = rq[1].replace(/(\.\.\.|…)\s*$/, "").replace(/\.\s[\s\S]*$/, "").replace(/\s+(?:in|of) the \w+ (?:groups?|lots?|items?) (?:below|above|listed)\b[\s\S]*$/i, "");
      var sp = /^(.{20,}?)\s+to\s+/.exec(t); if (sp) t = sp[1];
      if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "") + "…";
      t = t.charAt(0).toUpperCase() + t.slice(1);
    }
    var codey = /\d/.test(t) && words < 2 && t.length < 40;
    t = t.replace(/^\d{4}\s*[-–]\s*\d{4}\s+(?=[A-Za-z])/, "");
    if ((boiler || codey) && r) { var sh = scopeHeadline(r.scope); if (sh) t = sh; else if (boiler) t = "Bid notice (no description given)"; }
    if (r && r.level !== "Federal" && code) {
      var N = window.STATE_NAMES || {}, S = N[code];
      var tail = "(?=\\s*[,;(:]|\\s*$)", lead = "\\s*(?:,|\\b(?:in|for|at|across|within|statewide in))\\s+(?:the\\s+)?";
      if (code === "NYC") {
        t = t.replace(new RegExp(lead + "(?:City of )?(?:New York City|NYC|Five Boroughs of New York City)(?:\\s+(?:city )?government)?" + tail, "gi"), "")
          .replace(new RegExp("\\s*,\\s*New York" + tail, "gi"), "")
          .replace(/\b(?:the\s+)?(?:City of New York|New York City|NYC)(?:'s)?\s+(?=\S)/gi, "");
      } else if (code === "NY") {
        t = t.replace(new RegExp(lead + "(?:State of )?New York(?: State)?" + tail, "gi"), "").replace(/\b(?:the\s+)?(?:State of )?New York State(?:'s)?\s+(?=\S)/gi, "");
      } else if (S && S !== "New York") {
        var q = S.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(lead + "(?:State of )?" + q + tail, "gi"), "").replace(new RegExp("\\s*\\(" + q + "\\)", "gi"), "")
          .replace(new RegExp("\\b(?:the\\s+)?State of " + q + "(?:'s)?\\s+", "gi"), "state ")
          .replace(new RegExp("\\b" + q + "'s\\s+", "gi"), "")
          .replace(new RegExp("\\b" + q + "\\s+(?=state (?:government|agenc|employee))", "gi"), "")
          .replace(new RegExp("(?<!\\bof )(?<!\\bState of )\\b" + q + "\\s+(?!State\\b)(?=[A-Za-z])", "gi"), "");
      }
      // a city or town named only as the buyer: ", City of Lowell" / "for City of Salem" / "the City of Medford's ordinances"
      t = t.replace(/\s*,\s*(?:City|Town) of [A-Z][\w.' -]*?$/, "").replace(/\s+for\s+(?:the\s+)?(?:City|Town) of [A-Z][\w.' -]*?$/, "")
        .replace(/\b(?:the\s+)?(?:City|Town) of [A-Z][\w.-]*(?: [A-Z][\w.-]*)?'s\s+/g, "the city's ");
      t = t.replace(/\b(for|at|by|with|from) (Department|Dept|Division|Office|Commission|Board|Bureau|Agency|Authority)\b/g, "$1 the $2");
    }
    // tails and labels that say nothing about what is wanted: place of performance, street addresses, option-year terms, set-aside prefixes (shown as tags already)
    t = t.replace(/\s*\|\s*(?:POP|Period of Performance|PoP)\b[\s\S]*$/i, "").replace(/\s*\|\s*$/, "")
      .replace(/\s*\(?\bPOP:?[^)|]*\)?\s*$/i, "")
      .replace(/\s*[-–,]\s*(?:base\s+(?:year\s+)?plus\s+\w+\s+option\s+years?|base\s+(?:year\s+)?(?:and|\+)\s+\w+\s+option\s+years?|\w+\s+option\s+years?)\s*$/i, "")
      .replace(/\s*\((?:brand|brand name|brand name or equal)\)/gi, "")
      .replace(/^(?:(?:total\s+|partial\s+)?(?:SDVOSB|VOSB|WOSB|EDWOSB|HUBZone|8\(a\)|small business|SB)(?:\s+set[- ]aside)?)(?:\s*[-–:|]\s*|\s+)(?=[A-Za-z])/i, "")
      .replace(/,\s*\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Z][\w.' -]*?(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|highway|hwy|way|parkway|pkwy)\b\.?[\s\S]*$/i, "")
      .replace(/,\s*[A-Z][\w.' -]{2,50}\s+(?:Health Care|Healthcare|VA|Veterans)\s+(?:System|Network|Medical Center|VISN)\s*$/i, "")
      .replace(/,\s*(?:VISN\s*\d+|[A-Z][\w.' -]{2,40}\s+(?:VA Medical Center|VAMC|Air Force Base|AFB|Naval Station|Army Depot))\s*$/i, "");
    t = t.replace(/(?<=\S{4,}.{8,}),\s*(?:[A-Z][\w.&']*\s+){1,4}(?:Port District|Commission|Authority)$/, "");   // buyer named at the tail
    t = stripNoise(t);
    t = t.replace(/\s*(?:\.{2,}|…)+\s*$/, "");   // headlines never end in a trailing "..." (the dangling "for the" is dropped below)
    t = t.replace(/\s+([,.;:])/g, "$1").replace(/(^|\s)[,;:]+\s*/g, "$1").replace(/\s{2,}/g, " ").replace(/(?:\s+(?:for|in|at|of|the|and|to|by|with|-|–))+\s*$/i, "").replace(/[,;:\s-]+$/, "").trim();
    t = t.replace(/&(?=[A-Za-z])/g, "& ");
    if ((t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length) t += ")";   // title cut off mid-parenthesis
    if (t.length < 8) t = orig.replace(/^not clear from the listing:\s*/i, "");
    // an acronym that opens the title (STC, SCDOT, IT) stays in capitals when the source wrote it that way
    var fw = /^[A-Za-z]{2,6}\b/.exec(t), ow = /^[A-Z]{2,6}\b/.exec(orig);
    if (fw && ow && fw[0].toUpperCase() === ow[0] && !/^(THE|FOR|AND|NEW|OFF|ONE|TWO|OUR|ALL|ANY|USE|OIL|AIR|CAR|BUS|PAY|WEB|BID|RFQ|RFP|IFB|ITB|RFB|RFI|ITN|OF|TO|IN|ON|AT|BY|AS|AN|OR|IS|NO)$/.test(ow[0]) &&
        (ow[0].length <= 3 || !/[AEIOUY]/.test(ow[0]) || /(?:DOT|DOC|DOH|DHS)$/.test(ow[0]) || KEEP_CAPS.test(ow[0]))) t = ow[0] + t.slice(fw[0].length);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  window.cleanBidTitle = function (t, raw) { return cleanTitle(t, raw, raw && raw.level === "Federal" ? "US" : String((raw && raw.id) || "").split("-")[0].replace("TXDOT", "TX")); };

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
      var title = nice(r.plainTitle || (r.level === "Federal" && window.fedItemTitle ? window.fedItemTitle(r.title, r.scope) : shortTitle(r.title, r.scope)));
      title = cleanTitle(title, r, code);
      var agency = nice(r.agency), region = (r.details && r.details.region) || "";
      // a vague title ("Various Rail") gets the buyer added so it says something: "Various Rail (Metro-North Railroad)"
      if (agency && /\bvarious\b/i.test(title) && title.split(/\s+/).length <= 3) {
        var who = agency.replace(/^.{2,6}\s+[-–]\s+(?=\S)/, "");
        if (who && title.toLowerCase().indexOf(who.toLowerCase()) < 0) title += " (" + who + ")";
      }
      return { raw: r, id: r.id, title: title, agency: agency, level: r.level, code: code, noDue: noDue,
        days: noDue ? null : Math.round((pDate(r.due) - today) / DAY), due: r.due, seen: seen[r.id], value: val,
        region: region, url: safeUrl(r.rfqUrl), old: w.indexOf("Posted over a year ago") !== -1, aside: asideOf(r),
        ck: "c:" + (window.RFQCat ? window.RFQCat.label(r) : r.category || ""),
        posted: realPosted(r.posted), hay: (title + " " + agency + " " + region + " " + (r.scope || "") + " " + (r.category || "") + " " + r.id).toLowerCase() };
    }).filter(function (r) { return !(r.days != null && r.days < 0) && !r.old; });
  }

  // ---------- filters ----------
  function P() { return window.RFQProfile ? window.RFQProfile.get() : null; }
  function allCats() { return window.RFQProfile ? window.RFQProfile.categories() : []; }
  function defaultCats() { // what the vendor sells: from the setup wizard (pre-filled from the website), or every product category
    var p = P(), ids = allCats().map(function (c) { return c.id; });
    if (!p) return ids.filter(function (i) { return i !== "extra"; });
    var sel = ids.filter(function (i) { return i === "extra" || (p.cats || []).indexOf(i) >= 0; });
    (p.cats || []).forEach(function (i) { if (i.slice(0, 2) === "c:" && sel.indexOf(i) < 0) sel.push(i); }); // bid categories picked in the wizard
    return sel;
  }
  function selCats() { return st.cats === null ? defaultCats() : st.cats; }
  function hits(r) { return window.RFQProfile ? window.RFQProfile.catHits(r.raw) : {}; }

  var CLOSE_OPT = [["7", "Closing in 7 days"], ["14", "Closing in 14 days"], ["30", "Closing in 30 days"], ["60", "Closing in 60 days"], ["none", "No firm deadline"]];
  var POSTED_OPT = [["3", "Last 3 days"], ["7", "Last 7 days"], ["30", "Last 30 days"]];
  var VALUE_OPT = window.RFQProfile ? window.RFQProfile.valueOpts.slice() : [];
  var ASIDE_OPT = [["open", "Open to all (no set-aside found)"], ["small", "Small business set-aside"], ["vet", "Veteran-owned (SDVOSB)"], ["women", "Women-owned (WOSB)"], ["other", "HUBZone, 8(a), minority-owned"]];
  var SORT_OPT = [["new", "Newest first"], ["soon", "Closing date (soonest first)"], ["value", "Value (biggest first)"]];
  var SELECTS = { close: "Status", posted: "Published", value: "Bid value", aside: "Who can bid" };
  var OPTS = { close: CLOSE_OPT, posted: POSTED_OPT, value: VALUE_OPT, aside: ASIDE_OPT, sort: SORT_OPT };

  function passes(r, ctx) {
    var i;
    for (i = 0; i < ctx.words.length; i++) if (r.hay.indexOf(ctx.words[i]) < 0) return false;
    if (ctx.cats.length) { var h = hits(r), ok = ctx.cats.indexOf(r.ck) >= 0; for (i = 0; !ok && i < ctx.cats.length; i++) if (h[ctx.cats[i]]) ok = true; if (!ok) return false; }
    if (st.where.length && st.where.indexOf(r.code) < 0) return false;
    // Within one dropdown the ticked choices are alternatives (any one may match); nothing ticked = no filter.
    if (st.close.length && !st.close.some(function (k) { return k === "none" ? r.days == null : r.days != null && r.days <= +k; })) return false;
    if (st.posted.length) { var age = r.posted ? (today - new Date(r.posted.slice(0, 10) + "T00:00:00")) / DAY : null; if (age == null || !st.posted.some(function (k) { return age <= +k; })) return false; }
    if (st.value.length && window.RFQProfile && !window.RFQProfile.valueOk({ value: st.value, vmin: st.vmin, vmax: st.vmax }, r.value)) return false;
    if (st.aside.length && !st.aside.some(function (k) { return k === "open" ? r.aside.any : r.aside[k]; })) return false;
    return true;
  }
  function ctxNow() { return { words: st.kw.toLowerCase().split(/\s+/).filter(Boolean), cats: selCats() }; }

  function resetFilters(keepCats) { st.kw = ""; st.cats = []; st.where = []; st.close = []; st.posted = []; st.value = []; st.vmin = ""; st.vmax = ""; st.aside = []; st.shown = PAGE; }
  function lab(key, v) { var o = OPTS[key].filter(function (o) { return o[0] === v; })[0]; return o ? o[1] : v; }
  function money(x) { x = +x; return x >= 1e6 ? "$" + +(x / 1e6).toFixed(2) + "M" : x >= 1e3 ? "$" + +(x / 1e3).toFixed(1) + "K" : "$" + x; }
  function customLabel() {
    var lo = parseFloat(String(st.vmin).replace(/[$,\s]/g, "")), hi = parseFloat(String(st.vmax).replace(/[$,\s]/g, ""));
    return isFinite(lo) && isFinite(hi) ? money(lo) + " to " + money(hi) : isFinite(lo) ? "Over " + money(lo) : isFinite(hi) ? "Under " + money(hi) : "Custom amount";
  }
  function chipList() { // every active filter, shown as a removable chip under the filter row
    var out = [], cats = selCats(), cl = catOpts();
    if (st.kw.trim()) out.push(["kw", "“" + st.kw.trim() + "”"]);
    if (cats.length) out.push(["cats", "Category: " + (cats.length === 1 ? (cl.filter(function (c) { return c.v === cats[0]; })[0] || {}).label : st.cats === null ? "my products (" + cats.length + ")" : cats.length + " selected")]);
    if (st.where.length) out.push(["where", st.where.length === 1 ? stateName(st.where[0]) : st.where.length + " jurisdictions"]);
    ["close", "posted", "value", "aside"].forEach(function (k) {
      if (!st[k].length) return;
      var names = st[k].map(function (v) { return k === "value" && v === "custom" ? customLabel() : lab(k, v); });
      out.push([k, SELECTS[k] + ": " + (names.length <= 2 ? names.join(", ") : names.length + " selected")]);
    });
    return out;
  }

  // ---------- filter row ----------
  var ICON_SEARCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  var ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';
  var ICON_CHECK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // Real US state outlines (simplified Albers, from us-atlas). Federal = all dark; State = all light with that state dark; Local = city icon.
  var STATE_PATHS = {"AL":"M64.2 38.4L68.9 38.0L70.2 42.7L70.8 43.6L70.7 43.9L71.0 44.0L70.7 44.3L70.6 45.0L70.9 45.7L70.8 46.5L71.1 46.9L66.1 47.4L66.0 47.7L66.2 47.9L66.5 48.2L66.5 48.5L66.6 48.6L66.5 48.9L65.5 49.2L65.9 49.0L65.6 48.8L65.5 48.3L65.3 48.2L65.2 49.0L64.6 48.9L64.2 45.5L64.4 38.6L64.2 38.4Z","AK":"M9.9 57.0L10.2 56.6L10.3 56.5L10.3 56.7L10.5 56.9L9.9 57.0ZM9.3 57.5L9.6 57.3L9.7 57.4L9.7 57.2L9.9 57.1L10.3 57.1L10.4 57.5L10.2 57.4L10.0 57.7L10.2 57.7L10.0 57.8L9.9 57.7L9.6 58.0L9.7 57.7L9.5 58.0L9.3 57.5ZM4.4 54.7L5.0 54.7L5.1 54.9L5.1 55.1L4.8 55.2L4.4 54.7ZM3.1 60.1L3.7 59.9L3.6 59.7L3.9 59.7L3.8 59.9L4.0 59.9L3.7 60.1L3.1 60.1ZM5.1 50.5L6.4 50.0L6.6 50.0L6.5 50.4L7.1 50.5L7.4 50.4L7.1 50.2L7.0 49.8L7.1 49.8L7.3 50.2L7.3 49.8L6.7 49.6L6.6 49.2L5.9 48.4L6.2 48.1L6.7 48.1L6.9 48.0L7.5 47.1L7.8 47.1L8.3 46.8L8.7 46.8L8.9 46.5L9.3 46.6L9.2 46.9L9.4 46.6L9.6 46.9L10.1 46.9L10.2 47.2L10.9 47.1L12.2 47.4L12.6 47.2L13.3 47.4L14.7 54.7L15.1 54.7L15.5 54.5L15.5 54.7L16.4 55.5L16.7 55.2L16.7 54.8L16.9 54.6L18.1 55.4L19.2 56.6L20.0 56.7L20.3 57.3L20.2 57.6L20.0 57.8L19.7 57.0L19.8 57.5L19.4 57.4L19.4 57.1L19.4 57.4L19.3 57.4L19.2 56.9L19.1 57.2L18.9 57.0L19.0 56.7L18.3 56.3L18.1 56.0L18.4 56.0L17.8 55.6L17.6 55.7L17.0 55.0L17.5 55.8L17.1 55.7L16.7 55.3L16.6 55.4L17.0 55.7L16.8 55.9L15.3 55.2L15.3 54.8L15.1 55.1L14.6 55.1L14.7 55.0L14.1 55.0L13.4 55.3L13.6 55.1L13.2 55.0L13.2 54.8L13.1 55.0L12.8 54.9L12.9 54.8L12.5 55.1L12.5 54.9L12.8 54.8L12.5 54.7L12.7 54.6L12.5 54.6L12.5 54.4L11.9 54.7L11.9 54.5L11.9 55.0L12.0 55.0L12.0 55.4L11.9 55.2L11.9 55.4L11.5 55.5L11.5 55.3L11.4 55.7L11.2 55.6L11.1 55.9L11.0 55.7L10.9 56.0L10.6 56.1L10.5 55.9L10.9 55.6L10.7 55.7L10.5 55.6L10.7 54.9L11.1 54.6L11.5 54.7L11.2 54.5L11.4 54.2L10.9 54.4L10.5 54.8L10.1 55.5L10.0 55.6L10.0 55.7L9.6 56.0L9.6 56.2L10.0 56.4L9.6 56.9L8.8 57.4L8.6 57.8L7.8 58.2L7.7 58.3L7.9 58.4L7.7 58.6L7.2 58.6L7.1 58.9L7.1 58.6L6.4 59.0L6.3 58.8L6.1 59.1L5.8 59.1L5.8 58.9L5.8 59.2L5.5 59.1L5.4 59.3L5.5 59.4L4.7 59.5L4.9 59.2L5.3 59.1L5.4 59.2L5.5 59.0L6.2 58.5L6.6 58.5L6.6 58.7L6.7 58.6L6.9 58.7L6.7 58.5L6.9 58.3L7.6 57.9L8.1 57.3L8.4 56.3L8.0 56.5L7.8 56.2L7.6 56.7L7.1 56.1L6.5 56.4L6.4 55.8L6.6 55.7L6.4 55.1L6.1 55.3L5.7 55.3L5.4 54.7L5.3 54.7L5.5 54.3L5.1 53.8L5.3 53.7L5.2 53.6L5.3 53.6L6.0 52.6L6.4 52.8L6.7 52.5L7.1 52.5L7.3 52.3L7.1 51.8L7.4 51.6L7.3 51.4L6.7 51.8L6.6 51.5L6.6 51.7L5.9 51.6L5.5 51.4L5.4 50.9L5.6 50.9L5.1 50.5ZM2.5 60.3L3.1 59.9L3.1 60.0L2.5 60.3ZM3.4 51.8L3.5 51.6L3.8 51.8L3.9 51.8L4.5 52.2L4.4 52.3L4.1 52.4L3.4 51.8ZM18.5 57.3L18.5 57.0L19.0 57.2L19.6 57.9L19.4 58.0L19.3 57.9L19.2 57.7L19.2 57.9L19.0 57.8L19.3 58.0L19.2 58.1L18.8 57.8L18.9 57.6L18.6 57.4L18.6 57.2L18.5 57.3ZM18.0 56.7L18.2 56.7L18.2 56.5L18.5 56.4L18.9 56.7L18.6 56.8L18.4 56.9L18.3 57.3L18.0 56.7ZM17.5 55.6L17.8 55.7L18.0 56.1L18.1 56.3L17.9 56.6L17.5 55.6ZM17.4 56.5L17.5 56.3L17.7 56.3L18.0 57.2L17.5 56.8L17.5 56.5L17.4 56.5ZM16.9 56.1L16.9 55.9L17.2 55.8L17.5 55.9L17.6 56.0L17.7 56.3L17.4 56.2L17.4 56.5L16.9 56.1Z","AZ":"M14.5 40.7L14.9 40.7L15.0 40.5L15.0 40.1L14.7 39.9L14.7 39.4L14.8 39.2L15.2 38.9L15.4 38.0L16.3 37.4L15.9 36.9L15.8 36.3L15.6 35.9L15.9 35.3L15.9 34.7L16.0 33.1L16.7 33.1L17.0 33.5L17.3 33.1L17.6 31.3L26.5 32.8L24.7 45.6L20.8 45.0L14.2 41.2L14.5 40.7Z","CO":"M27.7 23.7L33.3 24.4L39.5 24.9L39.0 34.1L37.2 33.9L26.5 32.8L27.7 23.7Z","FL":"M79.4 60.4L80.0 59.8L80.5 60.0L79.4 60.4ZM71.1 46.9L71.4 47.5L76.6 47.1L76.7 47.6L77.0 47.6L76.9 46.6L77.0 46.5L78.1 46.6L78.7 48.6L79.5 50.0L80.5 51.1L80.7 52.2L82.2 54.9L82.4 57.5L82.2 57.4L82.1 58.3L82.2 58.3L82.4 57.8L82.4 58.0L82.2 58.7L81.6 59.3L82.0 58.6L80.5 58.9L80.5 58.5L80.1 57.8L79.3 57.4L79.2 57.5L78.7 56.4L78.3 56.1L78.1 56.3L77.9 55.8L78.1 55.9L78.0 55.2L77.7 55.8L76.5 54.1L76.7 54.1L77.0 53.6L77.1 53.2L76.9 53.2L77.0 53.4L76.8 53.3L76.8 53.1L76.5 53.0L76.4 53.2L76.7 53.4L76.5 53.9L76.2 53.3L76.1 52.6L76.3 52.9L76.4 51.7L75.9 50.5L75.4 50.6L75.0 50.0L74.6 49.8L74.5 49.5L73.2 48.7L72.7 48.7L72.6 49.0L72.6 49.2L72.3 49.2L71.6 49.7L71.6 49.6L71.2 49.8L71.4 50.0L72.0 49.6L71.4 50.1L70.7 50.0L70.6 49.6L70.8 49.9L70.8 49.7L70.6 49.4L68.9 48.6L67.8 48.6L66.4 49.0L66.6 48.6L66.5 48.5L66.5 48.1L66.0 47.7L66.1 47.4L71.1 46.9Z","GA":"M68.9 38.0L73.5 37.4L73.2 38.2L74.1 38.5L74.8 39.6L76.2 40.6L76.2 40.8L76.6 41.2L77.1 41.4L77.4 42.3L77.9 42.6L78.1 43.3L78.7 43.5L78.5 43.9L78.3 43.9L78.2 44.3L78.2 44.6L78.1 44.7L78.2 44.7L78.1 45.4L77.8 46.0L78.0 46.0L78.0 46.6L77.1 46.5L76.9 46.6L77.0 47.6L76.7 47.6L76.6 47.1L71.4 47.5L70.8 46.5L70.9 45.7L70.6 45.0L70.7 44.3L71.0 44.0L70.7 43.9L70.8 43.6L70.2 42.7L68.9 38.0Z","IN":"M64.0 23.0L64.5 23.1L65.2 22.8L68.6 22.4L69.3 28.4L69.1 28.6L69.4 29.2L68.8 29.5L68.3 29.4L68.4 29.8L67.9 30.5L67.7 30.5L67.6 31.1L67.4 31.3L67.0 31.1L66.8 30.8L66.4 31.6L66.2 31.5L66.0 31.4L65.5 31.9L64.7 31.5L64.7 31.8L64.1 31.7L64.1 32.0L63.8 31.7L63.9 31.8L64.0 30.8L64.2 30.9L64.7 29.7L64.3 28.8L64.5 28.4L64.0 23.0Z","KS":"M39.4 27.2L51.0 27.5L51.7 27.9L51.7 28.1L51.6 28.1L51.3 28.5L51.6 28.8L51.9 29.3L52.3 29.4L52.3 34.4L45.9 34.4L39.0 34.1L39.4 27.2Z","ME":"M91.0 15.0L90.4 14.4L89.1 10.2L89.2 10.1L89.5 10.3L89.4 9.9L89.7 9.9L89.5 9.6L90.0 8.6L89.8 8.0L90.0 7.4L89.9 6.7L90.6 4.8L90.9 4.8L91.0 5.1L91.2 5.2L92.0 4.8L92.0 4.6L92.3 4.6L93.0 5.0L93.9 8.0L94.5 8.0L94.6 8.7L94.9 9.0L95.0 8.8L95.2 8.8L95.6 9.3L95.7 9.5L95.5 9.9L95.1 10.0L95.2 10.1L95.0 10.4L95.0 10.6L94.7 10.4L94.4 11.0L94.1 11.0L94.2 11.3L93.9 11.4L93.8 11.0L93.5 11.1L93.7 11.4L93.7 12.0L93.5 11.5L93.2 11.4L93.1 11.0L92.9 11.3L93.0 12.3L92.7 12.7L92.7 12.5L92.5 12.5L92.4 12.8L92.3 12.7L92.0 13.2L91.8 13.1L91.5 13.4L91.0 15.0Z","MA":"M92.8 18.7L93.0 18.6L93.2 18.4L93.3 18.6L93.1 18.8L92.8 18.7ZM91.8 18.8L92.1 18.4L92.4 18.6L92.0 18.9L91.8 18.8ZM87.1 16.8L90.3 16.1L90.6 15.6L90.9 15.5L91.1 15.9L91.4 15.8L91.1 16.2L91.0 16.9L91.2 16.7L91.5 16.9L91.7 17.1L91.6 17.3L91.9 17.4L92.2 17.8L92.5 17.8L92.9 17.5L92.5 17.0L92.4 17.0L92.7 17.0L93.0 17.4L93.1 18.0L93.0 17.8L92.5 18.0L91.6 18.8L92.0 18.3L92.0 18.0L91.8 17.9L91.5 18.5L91.3 18.6L90.5 17.6L87.1 18.4L87.1 16.8Z","MN":"M47.9 7.1L51.1 7.1L51.1 6.2L51.4 6.2L51.6 6.4L51.9 7.6L53.1 7.9L53.2 8.1L53.8 7.9L54.4 7.9L54.9 8.0L54.8 8.2L55.1 8.2L55.3 8.7L55.5 8.4L55.8 8.4L56.0 8.7L56.6 8.9L56.6 9.1L57.1 9.0L57.6 8.6L57.8 8.9L58.8 8.8L59.2 9.1L59.8 9.0L57.7 10.1L55.9 11.9L56.0 12.1L55.9 12.0L55.6 12.2L55.6 13.6L55.0 14.0L54.8 14.4L54.8 14.7L55.1 15.0L54.9 16.6L55.4 17.0L55.7 17.0L56.4 17.5L56.5 17.8L57.2 18.2L57.6 18.7L57.6 19.3L49.1 19.5L49.1 15.4L48.4 14.7L48.9 14.2L48.9 13.7L48.6 12.3L48.5 10.2L48.1 8.9L48.1 7.8L47.9 7.1Z","NJ":"M84.9 24.6L85.1 24.1L86.1 23.1L85.4 22.6L85.0 22.1L85.2 21.6L85.0 21.4L85.4 20.4L87.0 20.9L86.9 21.7L86.7 21.8L86.7 22.2L87.1 22.2L87.3 23.7L86.4 25.9L86.3 25.9L86.3 25.4L85.9 25.4L85.0 25.0L84.9 24.6Z","NC":"M86.3 35.0L87.1 34.3L86.9 33.3L87.1 34.4L86.3 35.0ZM75.6 33.4L79.4 32.9L85.9 31.6L86.8 33.2L85.7 31.7L86.2 32.6L85.9 32.3L86.0 32.5L85.8 32.5L85.4 32.3L85.7 32.6L85.3 32.6L85.5 32.7L85.0 32.6L85.3 32.8L84.9 33.1L84.6 32.8L84.6 32.5L84.5 32.7L84.7 33.3L85.9 33.0L86.0 33.7L86.0 33.0L86.3 32.9L86.5 33.2L86.6 33.6L86.3 33.8L86.0 34.4L85.3 34.5L85.1 34.2L85.3 34.1L85.0 34.2L85.2 34.5L84.3 34.3L84.4 34.5L85.3 34.6L85.3 35.0L85.0 35.5L84.6 35.3L85.0 35.6L85.5 35.1L85.7 35.3L85.9 35.2L85.6 36.0L85.4 35.8L85.3 36.0L85.6 36.1L86.3 35.0L85.6 36.2L85.1 36.1L84.4 36.5L83.6 37.4L83.3 38.4L82.9 38.3L82.3 38.6L79.8 36.8L77.8 37.1L77.7 36.9L77.4 36.5L77.2 36.7L77.2 36.5L74.7 36.7L73.5 37.4L71.3 37.7L71.3 37.1L71.7 36.9L71.9 36.4L72.6 36.2L73.2 35.6L73.5 35.6L73.6 35.2L73.7 35.2L74.0 34.8L74.2 35.1L74.6 34.6L75.1 34.6L75.2 34.1L75.6 34.0L75.6 33.4Z","ND":"M37.7 6.6L47.9 7.1L48.1 7.8L48.1 8.9L48.5 10.2L48.5 11.2L48.6 12.3L48.9 13.1L48.9 14.0L43.2 13.8L37.1 13.4L37.7 6.6Z","OK":"M37.2 33.9L44.3 34.3L52.3 34.4L52.7 38.1L52.6 42.1L52.0 41.8L51.2 41.3L51.1 41.5L50.6 41.4L50.1 41.6L49.6 41.6L49.2 42.0L48.6 41.6L48.7 41.5L48.5 41.5L48.4 41.7L48.1 41.4L47.9 41.4L48.0 41.5L47.7 41.9L47.6 41.9L47.5 41.4L47.1 41.7L47.1 41.5L46.7 41.3L46.3 41.6L46.1 41.5L46.2 41.3L45.9 41.2L45.8 40.9L45.4 40.9L45.2 41.1L44.9 40.8L44.7 40.9L43.9 40.7L43.8 40.4L43.5 40.1L43.5 40.3L42.9 40.3L42.4 39.8L42.6 35.4L37.2 35.1L37.2 33.9Z","PA":"M75.6 20.9L76.8 20.0L76.9 20.6L84.1 19.2L84.3 19.5L84.6 19.5L85.0 20.2L85.5 20.4L85.0 21.4L85.2 21.6L85.0 21.9L85.1 22.3L85.3 22.4L85.4 22.6L86.1 23.1L85.1 24.1L84.8 24.1L84.5 24.5L83.7 24.6L76.5 26.0L75.6 20.9Z","SD":"M36.9 15.6L37.1 13.4L43.2 13.8L48.9 14.0L48.9 14.2L48.4 14.7L49.1 15.4L49.1 19.5L48.8 19.5L48.9 20.2L49.1 20.4L48.8 21.2L49.0 21.8L48.8 21.8L48.6 21.4L47.6 21.0L46.8 20.9L46.4 21.2L45.7 20.6L36.5 20.1L36.9 15.6Z","TX":"M37.2 35.1L42.6 35.4L42.4 39.8L42.9 40.3L43.5 40.3L43.5 40.1L43.8 40.4L43.9 40.7L44.7 40.9L44.9 40.8L45.2 41.1L45.4 40.9L45.8 40.9L45.9 41.2L46.2 41.3L46.1 41.5L46.3 41.6L46.8 41.3L47.2 41.7L47.5 41.4L47.6 41.9L47.7 41.9L47.9 41.4L48.4 41.7L48.5 41.5L48.7 41.5L48.6 41.6L49.2 42.0L49.6 41.6L50.1 41.6L50.6 41.4L51.1 41.5L51.2 41.3L52.9 42.3L53.5 42.3L53.5 45.8L54.0 46.3L54.0 46.7L54.6 48.0L54.2 49.1L54.3 50.2L53.9 50.7L54.1 51.1L53.5 51.1L52.2 51.8L52.8 51.4L52.2 51.4L52.4 51.1L52.2 50.9L52.0 51.1L51.8 51.1L51.7 51.4L52.0 51.5L52.0 51.9L51.5 52.2L51.5 52.4L52.2 51.8L52.3 51.9L51.0 53.0L49.2 53.9L47.8 55.1L47.2 56.2L47.0 57.0L47.4 59.2L47.2 58.2L47.0 58.2L47.1 58.1L46.9 57.4L47.0 56.4L47.6 55.1L48.2 54.5L48.9 54.1L48.9 54.0L48.4 54.2L48.2 54.0L48.2 54.4L47.9 54.6L47.7 54.6L47.4 54.7L47.7 54.7L47.4 55.3L46.8 55.2L47.0 55.3L47.0 55.5L47.3 55.6L46.9 56.4L46.7 56.5L46.7 56.3L46.5 56.6L46.9 56.6L46.8 58.0L47.2 58.8L47.1 59.2L47.4 59.3L47.4 59.5L46.8 59.7L46.4 59.3L45.2 59.2L44.0 58.5L43.5 58.4L43.1 57.4L42.8 57.0L42.8 56.5L42.6 56.3L42.7 55.8L42.0 55.2L41.9 54.8L41.2 54.1L40.5 52.2L39.8 51.3L39.4 51.1L39.1 50.6L37.8 50.5L37.3 50.3L37.2 50.5L36.6 50.5L36.2 51.6L35.7 52.2L35.1 52.0L33.1 50.5L32.8 49.8L32.8 49.2L32.4 48.2L31.6 47.5L30.6 46.3L30.2 46.0L29.9 45.4L29.5 45.1L29.5 44.7L36.3 45.3L37.2 35.1Z","WY":"M36.9 15.6L36.1 24.7L24.4 23.2L25.0 19.3L25.8 14.2L36.9 15.6Z","CT":"M87.1 18.4L89.9 17.8L90.2 19.3L88.9 19.8L88.5 19.8L88.2 20.3L87.4 20.8L87.2 20.6L87.6 20.3L87.4 20.1L87.1 18.4Z","MO":"M50.2 26.2L57.1 26.0L57.6 26.5L57.5 27.1L57.8 28.0L59.0 29.0L59.1 29.7L59.3 29.8L59.5 29.6L60.1 29.8L59.8 31.3L60.6 31.9L60.5 32.0L60.7 32.0L61.3 32.4L61.5 33.1L61.4 33.3L61.7 33.9L61.9 34.0L61.9 33.8L62.2 34.0L62.1 34.8L62.0 35.0L61.7 34.9L61.6 35.2L61.6 35.0L61.4 35.0L61.5 35.4L61.4 35.6L61.5 35.7L61.2 35.7L61.4 36.0L61.2 36.3L60.0 36.4L60.5 35.7L60.4 35.2L52.3 35.5L52.3 29.4L51.9 29.3L51.7 28.9L51.4 28.6L51.6 28.1L51.7 28.1L51.6 27.8L51.3 27.8L50.8 27.4L50.4 26.2L50.2 26.3L50.2 26.2Z","WV":"M73.3 29.5L73.8 29.3L73.8 29.0L74.0 28.9L73.9 28.5L74.1 28.0L74.4 28.3L74.6 28.1L74.5 27.8L74.6 27.3L74.8 27.3L75.0 26.9L75.2 27.1L75.4 26.9L75.9 26.3L76.1 24.7L75.9 24.0L76.1 23.9L76.5 26.0L78.2 25.7L78.4 26.9L79.0 26.1L79.2 26.2L79.4 25.7L79.7 25.9L80.0 25.8L80.5 25.3L81.1 25.4L81.2 25.7L81.4 26.0L81.3 26.5L80.3 25.9L80.3 26.6L79.7 27.7L79.4 27.5L79.0 28.6L78.4 28.3L78.3 29.1L77.6 30.5L77.8 30.6L77.7 30.9L76.9 31.4L76.7 31.3L76.7 31.5L76.1 31.8L75.8 31.6L75.3 32.0L74.8 31.7L74.7 31.5L74.8 31.4L74.1 31.1L73.3 30.1L73.3 29.5Z","IL":"M57.6 26.5L57.7 26.1L58.1 25.8L58.4 25.2L58.4 24.8L58.1 24.5L58.2 24.1L59.1 23.8L59.6 23.1L59.6 22.4L59.2 22.2L58.7 21.5L63.4 21.2L63.4 21.7L64.0 23.0L64.5 28.4L64.3 28.8L64.7 29.7L63.9 31.0L64.0 31.2L63.9 31.4L63.9 31.8L63.8 31.7L63.9 32.1L63.7 32.3L63.9 32.7L63.2 33.0L63.3 33.7L62.4 33.4L62.1 33.8L62.1 34.0L61.9 33.8L61.9 34.0L61.7 33.9L61.4 33.3L61.5 33.1L61.3 32.4L60.7 32.0L60.5 32.0L60.6 31.9L59.8 31.3L60.1 29.8L59.5 29.6L59.3 29.8L59.0 29.0L57.8 28.0L57.5 27.1L57.6 26.5Z","NM":"M26.5 32.8L37.2 33.9L36.3 45.3L33.9 45.1L29.5 44.7L29.4 44.9L29.6 45.2L26.4 44.8L26.3 45.8L24.7 45.6L26.5 32.8Z","AR":"M52.3 35.5L60.4 35.2L60.5 35.7L60.0 36.4L61.2 36.3L61.4 36.5L60.8 36.9L61.0 37.1L60.8 37.3L60.9 37.4L60.7 37.4L60.7 37.7L60.7 37.6L60.5 37.7L60.7 37.8L60.5 38.0L60.7 38.3L60.3 38.6L60.4 38.9L60.1 39.1L60.0 38.9L60.1 39.2L59.9 39.3L59.9 39.1L59.8 39.3L60.0 39.4L59.8 39.4L59.9 40.0L59.2 40.5L59.5 40.6L59.2 40.7L59.3 40.9L59.0 41.1L59.2 41.5L58.9 41.7L59.1 41.8L58.7 41.8L58.9 42.0L58.8 42.0L58.8 42.3L58.9 42.2L58.9 42.5L59.1 42.3L58.9 42.5L59.0 42.8L59.1 42.7L59.1 43.0L58.9 43.1L59.0 43.2L58.9 43.3L53.5 43.5L53.5 42.3L52.9 42.3L52.6 42.1L52.7 38.1L52.3 35.5Z","CA":"M7.7 37.4L8.1 37.7L8.2 37.9L8.1 37.9L7.7 37.4ZM7.5 38.4L7.8 39.0L7.6 38.9L7.5 38.4ZM5.7 35.5L6.4 35.8L6.0 35.9L5.7 35.7L5.7 35.5ZM5.0 35.5L5.5 35.7L5.2 35.8L5.0 35.5ZM3.3 16.0L10.0 17.9L8.3 24.6L15.7 35.6L15.9 36.9L16.3 37.4L15.4 38.0L15.2 38.9L14.8 39.2L14.7 39.9L15.0 40.1L15.1 40.4L14.9 40.7L9.9 40.2L9.8 39.8L9.9 38.8L9.7 38.2L8.8 37.1L8.2 36.9L8.2 36.2L7.6 36.2L7.1 35.8L6.5 34.9L4.9 34.4L4.6 34.0L5.0 32.8L4.6 32.6L4.7 32.1L4.4 31.7L3.5 29.6L3.5 29.0L3.8 28.9L3.9 28.3L3.5 28.1L3.1 27.4L3.3 26.1L3.5 26.1L3.5 26.6L3.9 27.0L3.6 25.7L3.9 25.6L3.9 25.5L3.6 25.4L3.5 25.9L3.3 26.0L2.9 25.4L2.6 25.3L2.8 24.8L2.0 23.0L2.4 20.9L1.8 19.7L1.9 19.3L2.8 18.2L3.1 17.3L3.0 16.4L3.3 16.0Z","DE":"M84.5 24.5L84.7 24.2L85.1 24.1L84.8 24.7L85.4 25.5L85.7 26.1L86.1 26.3L86.4 27.0L85.3 27.3L84.5 24.5Z","HI":"M30.5 58.4L31.0 57.9L30.9 57.4L31.0 57.3L32.2 57.8L33.0 58.8L33.2 59.0L31.7 59.8L31.4 60.3L30.8 59.9L30.9 59.4L30.5 58.4ZM29.2 55.8L29.4 55.5L29.6 55.9L30.2 55.8L30.7 56.2L29.9 56.6L29.7 56.1L29.3 56.0L29.2 55.8ZM28.4 55.8L28.7 55.8L28.9 56.1L28.6 56.2L28.4 55.8ZM27.9 55.4L28.0 55.1L29.0 55.2L29.1 55.4L28.8 55.5L27.9 55.4ZM25.8 54.3L26.1 54.3L26.5 54.0L26.7 54.6L27.0 54.6L27.1 54.9L26.2 54.9L25.8 54.3ZM22.6 53.3L23.1 52.8L23.5 52.9L23.7 53.1L23.3 53.6L22.6 53.3ZM21.6 53.7L21.9 53.3L22.0 53.6L21.7 53.8L21.6 53.7Z","IA":"M49.1 19.5L57.6 19.3L57.7 19.6L57.9 19.9L57.7 20.2L58.0 21.1L58.6 21.2L59.2 22.2L59.6 22.4L59.6 22.9L59.3 23.6L58.2 24.1L58.1 24.5L58.4 24.8L58.4 25.2L58.1 25.8L57.7 26.1L57.7 26.4L57.5 26.5L57.2 26.1L57.1 26.0L50.2 26.2L50.0 25.9L50.1 24.8L49.9 24.2L49.6 24.0L49.6 23.0L49.3 22.8L49.1 21.8L48.8 21.3L49.1 20.4L48.9 20.2L48.8 19.5L49.1 19.5Z","KY":"M62.1 34.0L62.1 33.8L62.3 33.4L63.3 33.7L63.2 33.0L63.9 32.7L63.7 32.3L63.9 32.0L64.2 31.9L64.1 31.7L64.7 31.8L64.7 31.5L65.5 31.9L65.7 31.6L66.1 31.3L66.4 31.6L66.8 30.8L67.0 31.1L67.4 31.3L67.6 31.1L67.7 30.5L67.9 30.5L68.4 29.8L68.3 29.4L68.8 29.5L69.4 29.2L69.1 28.6L69.4 28.3L70.1 28.5L70.4 29.0L71.0 29.0L71.4 29.3L71.6 29.1L72.1 29.2L72.7 28.8L72.8 29.2L73.3 29.4L73.3 30.1L73.6 30.6L74.1 31.1L74.7 31.3L74.1 32.0L73.5 32.5L73.3 33.0L73.0 33.2L72.9 33.4L72.0 33.9L64.1 34.5L64.1 35.0L61.7 35.1L61.7 34.9L62.0 34.9L62.1 34.7L62.1 34.0Z","MD":"M78.2 25.7L84.5 24.5L85.3 27.3L86.4 27.0L86.3 28.0L85.2 28.5L85.2 28.0L85.0 28.1L85.1 27.9L85.0 27.8L85.0 27.5L84.9 27.8L84.8 27.6L84.8 27.9L84.6 27.9L84.1 27.4L84.2 27.1L84.6 27.1L84.2 26.8L84.0 27.0L84.1 26.6L84.2 26.6L84.2 26.4L83.9 26.6L83.9 26.2L84.2 26.2L84.2 26.0L84.1 26.2L83.9 25.9L84.0 25.5L84.3 25.3L84.3 24.9L84.1 25.0L84.2 25.2L83.9 25.4L83.8 25.2L83.9 25.6L83.7 25.4L83.8 25.6L83.6 25.9L83.3 25.8L83.8 26.3L83.6 26.9L84.4 28.4L84.1 28.2L84.1 28.3L83.8 28.1L83.5 28.2L83.3 27.9L83.4 28.1L83.2 28.1L83.0 27.8L82.6 28.0L82.6 27.6L83.0 26.7L82.7 26.5L82.6 26.7L81.9 26.5L81.9 26.2L81.3 26.0L81.1 25.4L80.5 25.3L79.9 25.9L79.4 25.7L79.2 26.2L79.0 26.1L78.4 26.9L78.2 25.7Z","MI":"M66.2 13.9L66.4 13.5L66.5 13.8L66.2 13.9ZM65.2 22.8L65.5 22.4L66.0 21.0L65.9 20.0L65.2 18.4L65.4 18.0L65.2 17.5L65.5 16.8L65.5 16.1L65.7 15.9L65.7 15.5L66.1 15.4L66.5 14.7L66.4 15.6L66.5 15.7L66.6 15.2L66.6 15.8L66.8 15.3L66.7 14.6L67.4 14.2L67.0 13.8L67.3 13.4L67.2 13.4L67.5 13.3L68.5 13.5L68.7 13.8L69.7 14.0L70.0 14.5L70.1 14.7L69.8 14.7L70.2 15.4L70.2 16.2L70.0 16.4L69.9 16.9L69.4 17.3L69.4 17.7L69.9 18.0L70.2 17.7L70.2 17.3L70.4 17.3L70.2 17.2L71.0 16.8L71.2 16.8L71.5 17.2L72.2 19.1L72.1 20.0L71.9 20.2L71.9 19.9L71.6 19.9L71.5 20.7L71.3 20.8L71.3 21.3L70.9 22.1L68.6 22.5L68.6 22.4L65.2 22.8ZM60.1 9.2L61.2 8.5L61.4 8.4L61.1 8.7L60.5 9.1L60.7 9.2L60.3 9.3L60.1 9.2ZM58.5 12.3L59.5 11.7L60.1 11.6L60.7 11.2L61.9 10.1L62.4 10.0L62.6 10.1L62.2 10.2L61.5 11.2L61.6 11.7L62.0 11.2L61.8 11.5L62.4 11.2L62.8 11.4L63.3 12.1L63.8 12.0L64.2 12.2L64.4 12.1L64.3 11.9L64.5 12.1L65.2 11.5L67.0 11.1L67.0 11.8L67.6 11.7L67.6 11.8L68.3 11.5L68.4 12.1L68.2 12.3L68.4 12.3L68.9 12.6L69.0 12.6L68.9 12.4L69.2 12.3L69.5 12.6L69.4 12.8L68.5 12.7L68.1 12.9L67.6 12.7L67.6 13.2L67.1 12.8L66.3 12.7L66.0 13.1L65.1 13.2L64.7 14.0L64.5 13.8L64.7 13.3L64.4 13.5L64.1 13.8L64.0 13.5L63.2 15.3L63.0 15.1L63.0 14.6L62.7 14.7L62.8 14.0L62.3 13.8L62.3 13.5L59.0 12.8L58.8 12.4L58.5 12.3Z","MS":"M58.9 43.3L59.0 43.2L58.9 43.1L59.1 43.0L59.1 42.7L59.0 42.8L58.9 42.5L59.1 42.3L58.9 42.5L58.9 42.2L58.8 42.3L58.8 42.0L58.9 42.0L58.7 41.8L59.1 41.8L58.9 41.7L59.2 41.5L59.0 41.1L59.3 40.9L59.2 40.7L59.5 40.6L59.2 40.5L59.9 40.0L59.8 39.4L60.0 39.4L59.8 39.3L59.9 39.1L59.9 39.3L60.1 39.2L60.0 38.9L60.1 39.1L60.4 38.9L60.3 38.7L64.2 38.4L64.4 38.6L64.2 45.5L64.6 48.9L64.4 49.1L63.8 49.0L62.9 49.2L62.9 49.1L62.6 49.5L62.4 49.5L61.8 48.5L61.9 47.7L58.3 47.9L58.4 47.8L58.2 47.3L58.5 47.3L58.3 47.0L58.5 47.1L58.4 46.7L58.6 46.6L58.4 46.5L58.6 46.5L58.6 46.3L58.9 46.1L58.7 46.1L58.7 46.0L59.2 45.5L59.1 45.5L59.3 45.2L59.0 45.3L59.0 45.1L59.4 45.1L59.5 44.8L59.1 44.5L59.3 44.4L59.2 44.3L59.2 44.1L59.1 44.3L59.0 44.1L59.2 43.9L59.0 43.9L59.1 43.6L59.1 43.4L58.9 43.5L58.9 43.3Z","MT":"M19.8 3.9L28.5 5.5L37.7 6.6L36.9 15.6L32.1 15.1L25.8 14.2L25.6 15.4L25.2 14.7L24.9 15.1L23.7 14.8L23.5 15.1L22.8 14.9L22.7 15.2L22.5 14.9L22.4 14.2L21.9 13.9L22.0 13.4L21.7 12.7L21.7 12.1L21.5 11.8L20.8 12.3L20.5 12.0L20.6 11.5L20.9 11.3L20.8 10.7L21.3 9.6L20.9 9.6L20.8 9.3L20.7 9.4L20.1 8.0L19.5 7.4L19.7 7.4L19.6 7.2L19.7 6.9L19.3 6.2L19.8 3.9Z","NH":"M88.6 11.1L88.6 10.5L88.8 10.3L89.1 10.4L89.1 10.2L90.4 14.4L91.0 15.0L90.9 15.5L90.6 15.6L90.3 16.1L88.4 16.5L88.2 16.2L88.3 15.9L88.1 14.7L88.3 13.3L88.2 12.9L88.8 12.2L88.6 11.7L88.6 11.1Z","NY":"M86.9 21.7L86.8 22.0L86.7 22.1L86.7 21.8L86.9 21.7ZM76.8 20.0L77.6 19.2L78.0 18.6L77.6 18.0L77.5 17.6L78.4 17.2L79.6 17.0L80.0 17.2L80.9 16.9L81.7 16.2L81.9 16.1L81.7 15.4L81.9 15.2L81.5 15.0L81.5 14.6L82.0 14.1L82.9 12.8L83.4 12.3L85.8 11.8L85.9 12.7L86.1 13.1L86.1 14.0L86.5 14.9L86.7 15.0L87.1 16.8L87.1 18.3L87.4 20.1L87.6 20.3L87.2 20.6L87.4 20.8L87.2 21.2L87.3 21.3L87.7 20.8L88.2 20.8L88.3 20.7L89.1 20.4L89.6 19.9L89.6 20.1L90.0 20.2L90.3 19.9L88.3 21.4L87.0 21.9L86.9 21.6L87.0 20.9L85.4 20.3L85.0 20.2L84.6 19.5L84.3 19.5L84.1 19.2L76.9 20.6L76.8 20.0Z","OH":"M68.6 22.5L70.8 22.2L71.8 22.5L71.9 22.4L72.6 22.7L73.3 22.3L73.8 22.3L74.4 21.6L75.6 20.9L76.1 23.9L75.9 24.1L76.1 24.7L75.9 26.1L75.4 26.9L75.2 27.1L75.0 26.9L74.5 27.5L74.6 28.1L74.4 28.3L74.1 28.0L74.0 28.1L73.9 28.5L74.0 29.0L73.8 29.0L73.8 29.3L73.4 29.5L72.8 29.2L72.7 28.8L72.1 29.2L71.6 29.1L71.4 29.3L71.0 29.0L70.4 29.0L69.9 28.3L69.3 28.4L68.6 22.5Z","OR":"M7.1 7.0L7.3 7.3L7.7 7.4L8.0 7.7L7.9 8.7L8.5 9.1L9.4 9.0L10.1 9.2L10.3 9.5L11.2 9.4L11.5 9.6L13.9 9.5L17.1 10.2L17.6 11.2L16.7 12.6L15.8 13.5L15.7 13.9L15.9 14.0L16.2 14.3L15.8 15.0L14.9 19.1L9.6 17.8L3.3 16.0L3.1 15.7L3.4 14.6L3.3 14.0L4.5 12.1L5.8 9.0L6.4 7.4L6.4 6.9L6.6 7.1L7.1 7.0Z","TN":"M61.2 36.3L61.4 36.0L61.2 35.7L61.5 35.7L61.4 35.6L61.5 35.4L61.5 35.2L64.1 35.0L64.1 34.5L70.4 34.1L75.6 33.3L75.6 34.0L75.2 34.1L75.1 34.6L74.6 34.6L74.2 35.1L74.0 34.8L73.7 35.2L73.6 35.2L73.5 35.6L73.2 35.6L72.6 36.2L71.9 36.4L71.7 36.9L71.3 37.1L71.3 37.7L60.3 38.7L60.7 38.3L60.5 38.0L60.7 37.8L60.5 37.7L60.7 37.6L60.7 37.7L60.7 37.4L60.9 37.4L60.8 37.3L61.0 37.1L60.8 36.9L61.4 36.5L61.2 36.3Z","UT":"M19.8 20.1L24.7 21.0L24.4 23.2L27.7 23.7L26.6 31.6L26.5 32.8L17.6 31.3L19.8 20.1Z","VA":"M85.5 28.4L86.3 28.0L85.8 28.8L85.6 30.3L85.4 30.4L85.2 29.9L85.5 28.4ZM74.7 31.3L74.8 31.7L75.3 32.0L75.8 31.6L76.1 31.8L76.7 31.5L76.7 31.3L76.9 31.4L77.7 30.9L77.8 30.6L77.6 30.5L78.3 29.1L78.4 28.3L79.0 28.6L79.4 27.5L79.7 27.7L80.3 26.6L80.3 25.9L81.3 26.5L81.4 26.0L81.9 26.2L81.8 26.4L82.8 26.9L82.8 27.2L82.5 27.4L82.6 28.1L83.0 27.9L83.2 28.3L83.8 28.3L84.6 28.9L84.5 29.4L84.2 29.4L83.4 28.8L84.2 29.5L84.6 29.5L84.6 29.6L84.8 29.7L84.8 30.0L84.5 29.9L84.7 30.2L84.4 30.3L84.9 30.5L84.9 30.7L84.7 30.9L84.2 30.4L83.7 30.5L84.0 30.6L84.1 30.4L84.2 30.7L84.6 31.0L84.9 31.0L85.0 30.8L85.4 30.8L85.9 31.6L78.0 33.1L72.0 33.9L72.9 33.4L73.0 33.2L73.3 33.0L73.5 32.5L74.1 32.0L74.7 31.3Z","WA":"M9.5 3.1L9.9 2.8L9.9 3.1L9.6 3.2L9.7 3.3L9.7 3.7L9.8 3.5L9.9 3.9L9.9 4.0L9.7 3.8L9.7 3.3L9.5 3.1ZM9.1 2.1L9.4 2.3L9.3 2.1L9.6 2.0L9.8 2.2L9.7 2.2L9.5 2.6L9.1 2.1ZM18.4 3.6L17.0 9.4L17.1 10.2L13.9 9.5L13.6 9.6L12.9 9.4L11.8 9.6L11.2 9.4L10.4 9.5L9.8 9.1L8.6 9.1L8.0 8.8L8.0 7.7L7.7 7.4L7.3 7.3L7.2 7.0L6.9 6.9L6.3 6.8L6.6 6.0L6.6 6.6L6.7 6.0L7.0 5.9L6.6 5.7L6.6 5.4L7.1 5.4L6.7 5.1L6.6 5.3L6.8 3.4L6.6 3.0L6.6 2.4L6.8 2.1L6.7 1.9L6.9 1.9L7.7 2.7L8.5 3.1L8.9 3.1L9.2 3.4L9.5 3.3L9.5 3.9L9.1 4.3L9.1 4.0L8.4 4.8L8.8 4.9L8.5 4.8L9.6 4.0L9.6 3.8L9.7 3.9L9.2 5.2L9.1 5.4L9.1 5.0L9.0 5.1L8.9 5.5L8.8 5.2L8.9 5.0L8.8 5.1L8.7 5.4L8.9 5.6L9.3 5.2L9.4 5.3L9.6 5.2L9.7 4.5L10.1 3.9L10.1 3.3L9.9 3.3L10.0 3.6L9.8 3.4L9.9 3.2L10.1 3.2L10.1 3.0L9.7 2.6L9.9 2.5L10.1 2.7L10.2 2.4L10.2 2.0L10.0 2.1L9.9 1.5L10.0 1.4L18.4 3.6Z","WI":"M56.0 12.1L56.3 12.1L57.8 11.5L58.0 11.6L57.7 12.3L58.0 12.0L58.8 12.4L59.0 12.8L62.3 13.5L62.3 13.8L62.8 14.0L62.7 14.7L63.0 14.6L63.0 15.1L63.2 15.3L63.2 15.6L62.9 15.7L62.6 16.6L62.8 16.6L63.3 15.9L63.6 15.8L63.8 15.1L64.0 14.8L64.2 14.9L63.9 15.7L63.5 16.5L63.5 17.4L63.3 17.6L63.3 18.5L63.1 19.5L63.4 20.6L63.4 21.2L58.7 21.5L58.6 21.2L58.0 21.1L57.8 20.7L57.7 20.2L57.9 19.9L57.7 19.6L57.5 18.5L56.5 17.8L56.4 17.5L55.7 17.0L55.4 17.0L54.9 16.6L55.1 15.0L54.8 14.7L54.8 14.4L55.0 14.0L55.6 13.6L55.6 12.2L55.9 12.0L56.0 12.1Z","NE":"M36.5 20.1L45.7 20.6L46.4 21.2L46.8 20.9L47.6 21.0L48.6 21.4L48.8 21.8L49.1 21.8L49.2 22.6L49.7 23.4L49.6 23.8L49.9 24.2L50.1 24.8L50.0 25.9L50.2 26.3L50.4 26.2L50.5 26.8L51.0 27.5L39.4 27.2L39.5 24.9L36.1 24.7L36.5 20.1Z","SC":"M73.5 37.4L74.7 36.7L77.2 36.5L77.2 36.7L77.4 36.5L77.7 36.9L77.8 37.1L79.8 36.8L82.3 38.6L81.6 39.2L81.1 40.8L80.7 40.9L80.7 41.1L80.2 41.5L80.3 41.7L80.1 41.9L79.5 42.3L79.2 42.3L79.3 42.7L78.7 42.8L79.0 43.0L78.9 43.1L78.6 43.5L78.1 43.3L77.9 42.6L77.4 42.3L77.1 41.4L76.6 41.2L76.2 40.8L76.2 40.6L74.8 39.6L74.1 38.5L73.2 38.2L73.5 37.4Z","ID":"M17.1 10.2L17.0 9.4L18.4 3.6L19.8 3.9L19.3 6.2L19.7 6.9L19.6 7.2L19.7 7.4L19.5 7.4L20.1 8.0L20.7 9.4L20.8 9.3L20.9 9.6L21.3 9.6L20.8 10.7L20.9 11.3L20.6 11.5L20.5 12.0L20.8 12.3L21.5 11.8L21.7 12.1L21.7 12.7L22.0 13.4L21.9 13.9L22.4 14.2L22.5 14.9L22.7 15.2L22.8 14.9L23.5 15.1L23.7 14.8L24.9 15.1L25.2 14.7L25.6 15.4L24.7 21.0L14.9 19.1L15.8 15.0L16.2 14.3L15.8 14.0L15.7 13.7L17.6 11.2L17.1 10.2Z","NV":"M10.0 17.9L19.8 20.1L17.3 33.1L16.8 33.5L16.7 33.1L16.3 33.1L16.0 33.1L15.9 35.3L15.7 35.6L8.3 24.6L10.0 17.9Z","VT":"M85.8 11.8L88.6 11.1L88.6 11.7L88.8 12.2L88.2 12.9L88.3 13.3L88.1 14.6L88.2 15.6L88.2 16.2L88.4 16.5L87.1 16.8L86.7 15.0L86.6 14.8L86.4 15.0L86.4 14.5L86.1 14.0L86.1 13.1L85.9 12.7L85.8 11.8Z","LA":"M57.7 51.1L58.0 51.1L58.3 51.2L58.2 51.3L58.0 51.4L57.7 51.1ZM53.5 43.5L58.9 43.3L58.9 43.5L59.0 43.5L59.1 43.4L59.0 43.9L59.2 43.9L59.0 44.1L59.1 44.3L59.2 44.1L59.2 44.3L59.3 44.4L59.1 44.5L59.5 44.8L59.4 45.1L59.0 45.1L59.0 45.3L59.3 45.2L59.1 45.5L59.2 45.5L58.7 46.0L58.7 46.1L58.9 46.1L58.6 46.3L58.6 46.5L58.4 46.5L58.6 46.6L58.4 46.7L58.5 47.1L58.3 47.0L58.5 47.3L58.2 47.3L58.4 47.8L58.3 47.9L62.0 47.7L61.8 48.5L62.5 49.5L62.1 49.9L61.9 49.9L61.9 50.1L62.4 50.2L62.6 49.8L62.8 49.8L62.7 50.0L62.8 50.1L63.1 50.0L62.9 50.2L63.1 50.2L62.8 50.3L63.0 50.4L63.0 50.5L62.8 50.4L62.7 50.7L62.5 50.6L62.3 51.0L62.6 51.3L63.2 51.4L63.5 51.7L63.7 51.7L63.5 51.8L63.6 51.8L63.4 52.2L63.2 52.0L62.9 52.4L63.1 51.9L63.0 51.7L62.9 51.9L62.4 51.6L62.0 51.5L61.3 52.1L60.8 51.5L60.5 51.7L60.1 52.3L59.8 52.0L59.2 51.9L59.0 51.7L59.2 51.6L59.5 51.8L59.2 51.4L59.0 51.5L59.0 51.3L58.8 51.4L58.6 51.0L58.4 51.0L58.4 50.8L57.9 50.9L58.0 50.6L57.3 50.8L57.6 51.2L57.1 51.3L55.4 50.8L54.1 51.0L53.9 50.7L54.3 50.2L54.2 49.1L54.6 48.0L54.0 46.7L54.0 46.3L53.5 45.8L53.5 43.5Z","RI":"M91.1 18.3L91.3 18.6L91.2 18.8L91.0 18.4L91.1 18.7L90.9 18.8L91.1 18.3ZM90.2 19.3L89.9 17.8L90.5 17.6L91.0 18.2L90.9 18.4L90.9 18.3L90.7 18.1L90.6 18.4L90.8 19.1L90.2 19.3Z"};
  function mapIcon(r) {
    var tip, inner = "";
    if (r.level !== "Federal" && !STATE_PATHS[r.code]) {
      return '<span class="hm-map" title="Local government bid"><svg width="44" height="44" viewBox="0 0 44 44" aria-label="Local"><rect x="3" y="3" width="38" height="38" rx="10" fill="#ccfbf1"/><path d="M10 33V20h8v13M18 33V12h9v21M27 33V22h7v11M8 33h28" fill="none" stroke="#0f766e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M21 17h3M21 22h3M21 27h3" stroke="#0f766e" stroke-width="1.6" stroke-linecap="round"/></svg></span>';
    }
    var fed = r.level === "Federal";
    tip = fed ? "Federal bid (nationwide)" : stateName(r.code) + " bid";
    for (var k in STATE_PATHS) inner += '<path d="' + STATE_PATHS[k] + '" fill="' + (fed || k === r.code ? "#1e3a8a" : "#bfd3f7") + '" stroke="#fff" stroke-width=".7" stroke-linejoin="round"/>';
    return '<span class="hm-map" title="' + esc(tip) + '"><svg width="72" height="45" viewBox="0 0 98 62" aria-label="' + esc(tip) + '">' + inner + "</svg></span>";
  }
  var ICON_CAL = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h.01"/></svg>';
  var ICON_CLOCK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  // The simple filters are multi-select dropdowns too: tick as many as you like (any one may match).
  // One toggle link per dropdown: "Select all" until everything is ticked, then "Clear all".
  function tog(a, all) { return '<button type="button" data-a="' + a + '">' + (all ? "Clear all" : "Select all") + "</button>"; }
  function selectHtml(key) {
    var cust = key === "value" && st.value.indexOf("custom") >= 0 ? '<span class="hm-cust"><input type="text" inputmode="numeric" data-vc="vmin" placeholder="Min $" aria-label="Minimum value" value="' + esc(st.vmin) + '"><input type="text" inputmode="numeric" data-vc="vmax" placeholder="Max $" aria-label="Maximum value" value="' + esc(st.vmax) + '"></span>' : "";
    return ddHtml(key, SELECTS[key], simpleOpts(key), st[key], tog(key + "-none", st[key].length >= simpleOpts(key).length), "") + cust;
  }
  function simpleOpts(key) { return OPTS[key].map(function (o) { return { v: o[0], label: o[1] }; }); }
  function ddText(label, opts, sel) {
    return label; // the label never changes; a set filter is shown by the outline (and the chip below) only
  }
  // Multi-select dropdown. Nothing ticked = no filter (any).
  function optHtml(key, o, sel) {
    return '<label class="hm-opt"><input type="checkbox" data-ms="' + key + '" value="' + esc(o.v) + '"' + (sel.indexOf(o.v) >= 0 ? " checked" : "") + "><span>" + esc(o.label) + "</span>" + (o.n != null ? "<em>" + o.n + "</em>" : "") + "</label>";
  }
  // Same list as the setup wizard: collapsible groups with a tick-all box. "My products" starts open, the rest collapsed.
  function groupedList(key, opts, sel) {
    var gs = [], idx = {}, list = "";
    opts.forEach(function (o) { var g = o.group || "Other"; if (!(g in idx)) { idx[g] = gs.length; gs.push({ name: g, items: [] }); } gs[idx[g]].items.push(o); });
    gs.forEach(function (g, i) {
      var n = g.items.filter(function (o) { return sel.indexOf(o.v) >= 0; }).length, op = !!st.openG[g.name];
      list += '<div class="hm-gh"><input type="checkbox" data-mgrp="' + i + '" aria-label="Select all in ' + esc(g.name) + '"' + (n === g.items.length ? " checked" : "") + '>' +
        '<div class="hm-gt" data-mg="' + i + '" data-gname="' + esc(g.name) + '" role="button" aria-expanded="' + op + '"><span class="hm-arr">' + (op ? "&#9662;" : "&#9656;") + "</span> " + esc(g.name) + " <em>" + n + "/" + g.items.length + "</em></div></div>" +
        '<div class="hm-kids" data-kids="' + i + '"' + (op ? "" : " hidden") + ">" + g.items.map(function (o) { return optHtml(key, o, sel); }).join("") + "</div>";
    });
    return list;
  }
  function syncGroups() { // refresh group tick boxes / counts without redrawing (keeps scroll position)
    Array.prototype.forEach.call($app.querySelectorAll('.hm-field[data-k="cats"] .hm-gh'), function (gh) {
      var kids = gh.nextElementSibling.querySelectorAll("input[data-ms]"), n = 0;
      Array.prototype.forEach.call(kids, function (i) { if (i.checked) n++; });
      var gb = gh.querySelector("[data-mgrp]"); gb.checked = n === kids.length; gb.indeterminate = n > 0 && n < kids.length;
      gh.querySelector("em").textContent = n + "/" + kids.length;
    });
  }
  function ddHtml(key, label, opts, sel, topLinks, cls, grouped) {
    var list = "", grp = null;
    if (grouped) list = groupedList(key, opts, sel);
    else opts.forEach(function (o) {
      if (o.group && o.group !== grp) { grp = o.group; list += '<div class="hm-grp">' + esc(grp) + "</div>"; }
      list += optHtml(key, o, sel);
    });
    return '<div class="hm-field dd ' + (cls || "") + (st.dd === key ? " open" : "") + '" data-k="' + key + '"><span class="hm-lb">' + esc(label) + '</span>' +
      '<button type="button" class="hm-dd-btn' + (sel.length ? " on" : "") + '" data-dd="' + key + '" aria-haspopup="listbox"><span data-lbl>' + esc(ddText(label, opts, sel)) + "</span></button>" +
      '<div class="hm-dd-panel"><div class="hm-dd-top">' + topLinks + '</div><div class="hm-dd-list">' + list + "</div></div></div>";
  }
  // Category dropdown: the vendor's product types first, then every category the bids themselves carry (grouped).
  // Only the product types that match the vendor's profile start ticked; everything else starts unticked.
  function catOpts() {
    var out = allCats().map(function (c) { return { v: c.id, label: c.label, n: rows.filter(function (r) { return hits(r)[c.id]; }).length, group: "My products" }; });
    var by = {};
    rows.forEach(function (r) { by[r.ck] = (by[r.ck] || 0) + 1; });
    var C = window.RFQCat, more = Object.keys(by).filter(function (k) { var l = k.slice(2).trim(); return l && !/^no data\b/i.test(l); }).map(function (k) {
      var l = k.slice(2);
      return { v: k, label: l || "No category listed", n: by[k], group: l && C ? C.group(l) : "Other" };
    });
    more.sort(function (a, b) {
      var ao = a.group === "Other" ? 1 : 0, bo = b.group === "Other" ? 1 : 0;
      return ao - bo || a.group.localeCompare(b.group) || (a.v === "c:") - (b.v === "c:") || a.label.localeCompare(b.label);
    });
    return out.concat(more);
  }
  // The setup wizard lists these too (everything except the product types, which it already knows).
  window.RFQExtraCats = function () { if (!rows) prep(); return catOpts().filter(function (o) { return o.group !== "My products"; }); };
  window.RFQJurisdictions = function () { if (!rows) prep(); return whereOpts(); }; // the setup wizard's step 2 lists these
  function whereOpts() {
    var n = {}; rows.forEach(function (r) { n[r.code] = (n[r.code] || 0) + 1; });
    var out = [];
    ["US", "NYC"].forEach(function (c) { if (n[c]) out.push({ v: c, label: stateName(c), n: n[c], group: c === "US" ? "Federal" : "City" }); });
    Object.keys(n).filter(function (c) { return c !== "US" && c !== "NYC"; }).sort(function (a, b) { return stateName(a).localeCompare(stateName(b)); })
      .forEach(function (c) { out.push({ v: c, label: stateName(c), n: n[c], group: "States" }); });
    return out;
  }
  var MORE_KEYS = ["value", "aside"], SIMPLE = ["close", "posted", "value", "aside"];
  function fieldsHtml() {
    return ddHtml("cats", "Category", catOpts(), selCats(), tog("cats-none", selCats().length >= catOpts().length), "", true) +
      ddHtml("where", "Jurisdiction", whereOpts(), st.where, tog("where-none", st.where.length >= whereOpts().length), "") +
      selectHtml("posted") + selectHtml("close") + selectHtml("value") + selectHtml("aside");
  }
  function moreHtml() {
    return "";
  }

  function VIEW_HTML() {
    var ic = {
      list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
      grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>'
    };
    return '<span class="hm-view" role="group" aria-label="View">' + ["list", "grid"].map(function (v) { return '<button type="button" class="hm-vb' + (st.view === v ? " on" : "") + '" data-a="view" data-v="' + v + '" aria-pressed="' + (st.view === v) + '" aria-label="' + v + ' view" title="' + v + ' view">' + ic[v] + "</button>"; }).join("") + "</span>";
  }
  // ---------- page ----------
  function shell() {
    var prof = P();
    $app.innerHTML = '<div class="hm"><div class="hm-nav"><div class="hm-in"><span class="hm-logo">Bid<i>.</i>Finder <span style="white-space:nowrap">– Discover Group, Inc.</span></span>' +
      '<button class="hm-btn" data-a="selection" title="Change which categories you see">&larr; Back to selection</button>' +
      // Profile button hidden for now: '<button class="hm-btn" data-a="profile">' + (prof ? "Edit my profile" : "Set up my profile") + '</button>' +
      '<button class="hm-btn" data-a="refresh">Refresh</button></div></div>' +
      '<div class="hm-in"><div class="hm-title"><h1>View Open Bids &amp; RFQs</h1><p id="hm-stats"></p></div>' +
      '<form class="hm-bar" data-form><label class="hm-kw"><input type="search" data-kw placeholder="Search by keyword or bid title" aria-label="Keyword" value="' + esc(st.kw) + '">' + ICON_SEARCH + '</label>' + VIEW_HTML() + '<div class="hm-fields" id="hm-fields"></div></form>' +
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

  function results() {
    var host = document.getElementById("hm-res"); if (!host) return;
    var ctx = ctxNow(), catLabel = {}; allCats().forEach(function (c) { catLabel[c.id] = c.label; });
    var list = rows.filter(function (r) { return passes(r, ctx); });
    list.sort(function (a, b) {
      if (st.sort === "value") return (b.value == null ? -1 : b.value) - (a.value == null ? -1 : a.value);
      if (st.sort === "new") { // posted date, newest first; unknown dates last; first-seen breaks ties
        var pa = String(a.posted || "").slice(0, 10), pb = String(b.posted || "").slice(0, 10);
        if (pa !== pb) return !pa ? 1 : !pb ? -1 : pb.localeCompare(pa);
        return String(b.seen || "").localeCompare(String(a.seen || ""));
      }
      return (a.days == null ? 9e9 : a.days) - (b.days == null ? 9e9 : b.days);
    });
    var chips = chipList();
    var h = '<div class="hm-filt">' + (chips.length ? "<b>Filtered by</b>" + chips.map(function (c) { return '<button class="hm-chip" data-x="' + c[0] + '" title="Remove this filter">' + esc(c[1]) + ICON_X + "</button>"; }).join("") + '<button class="hm-clear" data-a="clear">Clear All</button>' : "") + "</div>";
    h += '<div class="hm-resbar"><span class="hm-cnt">' + list.length.toLocaleString() + (list.length === 1 ? " result" : " results") + '</span><label for="hm-sort">Order By</label><select id="hm-sort" data-sel="sort">' +
      SORT_OPT.map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
    if (!list.length) h += '<div class="hm-empty"><h3>No bids match these filters</h3><p class="hm-sub">Try widening the category, jurisdiction or deadline.</p><button class="hm-go" data-a="clear">Clear all filters</button></div>';
    h += '<div class="hm-list' + (st.view === "grid" ? " grid" : "") + '">';
    list.slice(0, st.shown).forEach(function (r) {
      var hh = hits(r), ids = Object.keys(hh).filter(function (id) { return ctx.cats.length ? ctx.cats.indexOf(id) >= 0 : true; });
      var matchTag = ids.length ? '<span class="hm-tag match" title="' + esc(ids.map(function (id) { return hh[id].slice(0, 3).join(", "); }).join("; ")) + '">' + esc(ids.slice(0, 2).map(function (id) { return catLabel[id]; }).join(" · ")) + (ids.length > 2 ? " +" + (ids.length - 2) : "") + "</span>" : "";
      var asideTag = r.aside.any ? '<span class="hm-tag aside">' + esc(r.aside.small ? "Small business set-aside" : r.aside.vet ? "Veteran-owned set-aside" : r.aside.women ? "Women-owned set-aside" : "Set-aside") + "</span>" : "";
      var closing = r.days == null ? "No firm deadline" : mdy(r.due);
      h += '<div class="hm-item">' + mapIcon(r) + '<div><h3><a href="/explore.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.title) + "</a>" + valueTag(r) + "</h3>" +
        '<div class="hm-sub">' + esc(stateName(r.code)) + " &middot; " + esc(r.ck ? r.ck.slice(2) || "No category" : "No category") + "</div></div>" +
        '<div class="hm-dates"><div>' + ICON_CAL + "<b>Published</b></div><div>" + esc(r.posted ? mdy(r.posted) : "Unknown") + "</div><div>" + ICON_CLOCK + "<b>Closing</b></div><div>" + esc(closing) + (r.days != null && r.days >= 0 ? ' <span class="hm-left">' + (r.days === 0 ? "today" : r.days === 1 ? "tomorrow" : r.days + " days") + "</span>" : "") + "</div></div>" +
        "</div>";
    });
    h += "</div>";
    if (list.length > st.shown) h += '<button class="hm-showmore" data-a="more">Show more (' + (list.length - st.shown).toLocaleString() + " left)</button>";
    host.innerHTML = h;
  }

  // Bid value in green after the title: the amount, "Not specified" (notice read, none given) or "Couldn't determine" (notice not read).
  function valueTag(r) {
    if (r.value != null) return ' <span class="hm-val">' + esc(money(r.value)) + "</span>";
    return ' <span class="hm-val none">' + (r.raw && r.raw.aiRead ? "Value not specified" : "Couldn't determine value") + "</span>";
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

  // ---------- details side panel: slides in from the right, blurs the page behind ----------
  (function () {
    var css = document.createElement("style");
    css.textContent =
      "#dp-back{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .25s}" +
      "#dp-back.on{opacity:1;pointer-events:auto}" +
      "#dp{position:fixed;top:0;right:0;bottom:0;width:min(760px,100vw);z-index:1001;background:#fff;box-shadow:-8px 0 30px rgba(15,23,42,.25);transform:translateX(100%);transition:transform .28s ease;display:flex;flex-direction:column}" +
      "#dp.on{transform:none}" +
      "#dp .dp-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #e4e4f0;font:600 14px Roboto,system-ui,sans-serif;color:#64748b}" +
      "#dp .dp-bar a{color:#4338ca;text-decoration:none;margin-right:16px;font-size:13px}" +
      "#dp .dp-bar button{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#64748b}" +
      "#dp iframe{flex:1;border:0;width:100%}";
    document.head.appendChild(css);
    var back = document.createElement("div"); back.id = "dp-back";
    var dp = document.createElement("div"); dp.id = "dp";
    dp.innerHTML = '<div class="dp-bar"><span>Request details</span><span><button id="dp-x" aria-label="Close">&times;</button></span></div><iframe title="Request details"></iframe>';
    document.body.appendChild(back); document.body.appendChild(dp);
    var fr = dp.querySelector("iframe");
    function close() { back.classList.remove("on"); dp.classList.remove("on"); setTimeout(function () { if (!dp.classList.contains("on")) fr.removeAttribute("src"); }, 300); }
    back.addEventListener("click", close);
    dp.querySelector("#dp-x").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dp.classList.contains("on")) close(); });
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".hm-item h3 a");
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      fr.src = a.getAttribute("href") + "&embed=1";
      back.classList.add("on"); dp.classList.add("on");
    });
  })();

  $app.addEventListener("click", function (e) {
    var dd = e.target.closest("[data-dd]");
    if (dd) { st.dd = st.dd === dd.dataset.dd ? null : dd.dataset.dd; return syncOpen(); }
    var gt = e.target.closest("[data-mg]");
    if (gt) {
      var kids = gt.parentNode.nextElementSibling; kids.hidden = !kids.hidden; st.openG[gt.dataset.gname] = !kids.hidden;
      gt.setAttribute("aria-expanded", String(!kids.hidden)); gt.querySelector(".hm-arr").innerHTML = kids.hidden ? "&#9656;" : "&#9662;"; return;
    }
    var x = e.target.closest("[data-x]");
    if (x) {
      var k = x.dataset.x;
      if (k === "kw") { st.kw = ""; clearKw(); } else if (k === "cats") st.cats = []; else st[k] = [];
      st.shown = PAGE; return refreshAll();
    }
    var b = e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    if (d.a === "selection") { if (window.RFQProfile) window.RFQProfile.open(); return; }
    if (d.a === "profile") { window.location.href = "/profile.html"; return; }
    if (d.a === "refresh") { var rb = document.getElementById("refreshBtn"); if (rb) rb.click(); b.textContent = "Refreshing…"; return; }
    if (d.a === "clear") { resetFilters(false); clearKw(); return refreshAll(); }
    if (d.a === "more-filters") { st.more = !(st.more || MORE_KEYS.some(function (k) { return st[k].length; })); if (!st.more) { MORE_KEYS.forEach(function (k) { st[k] = []; }); } return refreshAll(); }
    if (d.a === "cats-none") st.cats = selCats().length >= catOpts().length ? [] : catOpts().map(function (c) { return c.v; });
    else if (d.a === "where-none") st.where = st.where.length >= whereOpts().length ? [] : whereOpts().map(function (o) { return o.v; });
    else if (d.a && d.a.slice(-5) === "-none" && SIMPLE.indexOf(d.a.slice(0, -5)) >= 0) {
      var sk = d.a.slice(0, -5), so = simpleOpts(sk);
      if (st[sk].length >= so.length) { st[sk] = []; if (sk === "value") { st.vmin = ""; st.vmax = ""; } } else st[sk] = so.map(function (o) { return o.v; });
    }
    else if (d.a === "more") { st.shown += PAGE; return results(); }
    else if (d.a === "view") {
      st.view = d.v === "grid" ? "grid" : "list";
      try { localStorage.setItem("rfq-view", st.view); } catch (e) {}
      Array.prototype.forEach.call(document.querySelectorAll("[data-a=view]"), function (b) { b.classList.toggle("on", b.dataset.v === st.view); b.setAttribute("aria-pressed", String(b.dataset.v === st.view)); });
      return results();
    }
    else return;
    st.shown = PAGE; refreshAll();
  });
  $app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.mgrp != null) { // group box ticks / unticks every category in the group
      Array.prototype.forEach.call(t.parentNode.nextElementSibling.querySelectorAll("input[data-ms]"), function (i) { i.checked = t.checked; });
      t = t.parentNode.nextElementSibling.querySelector("input[data-ms]"); if (!t) return;
    }
    if (t.dataset.sel) { st[t.dataset.sel] = t.value; st.shown = PAGE; return results(); } // the sort order stays a single choice
    if (t.dataset.ms) {
      var key = t.dataset.ms, ids = Array.prototype.slice.call($app.querySelectorAll('input[data-ms="' + key + '"]')).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      if (key === "cats") st.cats = ids; else st[key] = ids;
      var lbl = $app.querySelector('.hm-field[data-k="' + key + '"] [data-lbl]');
      if (lbl) lbl.parentNode.classList.toggle("on", ids.length > 0);
      if (key === "value" && (ids.indexOf("custom") >= 0) !== !!$app.querySelector("[data-vc]")) { st.shown = PAGE; return refreshAll(); } // show / hide the custom amount boxes
      if (key === "cats") syncGroups();
      st.shown = PAGE; results();
    }
  });
  var kwTimer = null;
  $app.addEventListener("input", function (e) { if (e.target.dataset.vc) { st[e.target.dataset.vc] = e.target.value; st.shown = PAGE; clearTimeout(kwTimer); kwTimer = setTimeout(results, 250); return; } if (e.target.dataset.kw != null) { st.kw = e.target.value; st.shown = PAGE; clearTimeout(kwTimer); kwTimer = setTimeout(results, 150); } });
  $app.addEventListener("submit", function (e) { e.preventDefault(); st.dd = null; syncOpen(); results(); });
  function profWhere() { var p = P(); return p && p.where && p.where.length ? p.where.slice() : []; } // [] = every jurisdiction
  function profList(v, opts) { return (Array.isArray(v) ? v : v && v !== "any" ? [v] : []).filter(function (x) { return opts.some(function (o) { return o[0] === x; }); }); } // older saves held one string
  function profValue() { var p = P(); return p ? profList(p.value, VALUE_OPT) : []; }
  function profAside() { var p = P(); return p ? profList(p.aside, ASIDE_OPT) : []; }
  function profRange() { var p = P() || {}; st.vmin = st.value.indexOf("custom") >= 0 ? p.vmin || "" : ""; st.vmax = st.value.indexOf("custom") >= 0 ? p.vmax || "" : ""; }
  // Apply every wizard choice to the page's filters. st.cats = null means "the categories saved in the wizard".
  function applyProfile() {
    st.cats = P() ? null : []; st.where = profWhere(); st.value = profValue(); st.aside = profAside(); profRange();
    st.kw = ""; st.close = []; st.posted = []; st.shown = PAGE;
  }
  applyProfile();
  window.addEventListener("rfqprofilechange", function () { applyProfile(); render(); });
  window.addEventListener("rfqwizardclose", render);
  render();
})();
