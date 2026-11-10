// Texas: ESBD (Electronic State Business Daily) has no feed and forbids automated reads (robots.txt), and the
// Comptroller's office confirmed (2026-11-10) that search results can be exported as CSV (max 20,000 rows).
// So this adapter reads a CSV that a person exported by hand: no request to txsmartbuy.gov is ever made.
//
// How to refresh: on txsmartbuy.gov hover Vendor > ESBD Bid Opportunities, set Status to Posted, search,
// export to CSV, and save it as imports/texas-esbd.csv (any .csv in imports/ whose name starts with "texas" works;
// the newest one is used). Then run: node fetch-states.js TX
//
// The export's column names were not available when this was written, so columns are matched by keyword
// (see FIELDS). If a column is missed the run fails with the headers it saw, so the keywords can be adjusted.
const fs = require("fs");
const path = require("path");
const { clean, toEastern } = require("./common");

const DIR = path.join(__dirname, "..", "imports");

// Field -> header keywords, tried in order; a header matches when it contains the keyword (case-insensitive).
const FIELDS = {
  id: ["solicitation id", "solicitation number", "solicitation #", "bid number", "id"],
  title: ["solicitation name", "solicitation title", "title", "name", "description"],
  agency: ["agency name", "agency", "department"],
  category: ["class/item", "nigp", "category", "type"],
  posted: ["posting date", "posted", "start date", "begin"],
  due: ["due date", "end date", "closing", "close", "deadline"],
  time: ["due time", "end time", "closing time", "time"],
  status: ["status"],
  description: ["description", "summary"]
};

// RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, optional BOM.
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function pickColumns(headers) {
  const h = headers.map((x) => x.toLowerCase().trim());
  const col = {};
  for (const [field, keys] of Object.entries(FIELDS)) {
    for (const k of keys) {
      const i = h.findIndex((x, idx) => x.includes(k) && !Object.values(col).includes(idx));
      if (i >= 0) { col[field] = i; break; }
    }
  }
  return col;
}

// "11/20/2026", "2026-11-20", "11/20/2026 2:00 PM", "11/20/2026 14:00" (+ optional separate time) -> Eastern { due, dueTime }.
// ESBD times are Central.
function stamp(dateStr, timeStr) {
  const s = clean(dateStr), t = clean(timeStr) || "";
  const d = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s), iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  let y, mo, da;
  if (d) { y = +d[3]; mo = +d[1]; da = +d[2]; } else if (iso) { y = +iso[1]; mo = +iso[2]; da = +iso[3]; } else return null;
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(s.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, "") + " " + t);
  if (!m) return { due: `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`, dueTime: null };
  let hh = +m[1]; if (m[3]) { hh %= 12; if (/pm/i.test(m[3])) hh += 12; }
  return toEastern(y, mo, da, hh, +m[2], "America/Chicago");
}

const isoDate = (s) => { const r = stamp(s, ""); return r ? r.due : null; };

// The export gives only the agency/member NUMBER (e.g. 601), not a name.
const agencyName = (a) => (!a ? "Texas agency" : /^\d+$/.test(a) ? `Texas agency ${a}` : a);

function newestCsv() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter((f) => /^texas.*\.csv$/i.test(f)); } catch { /* no folder */ }
  if (!files.length) throw new Error("No CSV imported: export from ESBD and save it as imports/texas-esbd.csv");
  return files.map((f) => ({ f, t: fs.statSync(path.join(DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0].f;
}

function parse(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV has no data rows");
  const col = pickColumns(rows[0]);
  const missing = ["id", "title", "due"].filter((k) => col[k] === undefined);
  if (missing.length) throw new Error(`CSV columns not recognised (${missing.join(", ")}); headers seen: ${rows[0].join(" | ").slice(0, 300)}`);
  const get = (r, k) => (col[k] === undefined ? "" : r[col[k]] || "");
  const out = [];
  for (const r of rows.slice(1)) {
    const id = clean(get(r, "id")), when = stamp(get(r, "due"), get(r, "time"));
    if (!id || !when) continue;
    const status = clean(get(r, "status"));
    if (status && !/posted|open|active/i.test(status)) continue; // skip awarded/cancelled/closed rows
    const titleCol = clean(get(r, "title")), desc = clean(get(r, "description"));
    out.push({
      id: id.replace(/[^A-Za-z0-9._-]+/g, "-"),
      title: titleCol, agency: agencyName(clean(get(r, "agency"))),
      category: clean(get(r, "category")) || "No data",
      posted: isoDate(get(r, "posted")),
      due: when.due, dueTime: when.dueTime,
      url: "https://www.txsmartbuy.gov/esbd/" + encodeURIComponent(id), // link back to the ESBD page for every notice
      description: desc && desc !== titleCol ? desc : "",
      region: "Texas"
    });
  }
  if (!out.length) throw new Error("No open solicitations parsed from the CSV");
  return out;
}

module.exports = {
  code: "TX", name: "Texas",
  async fetch() {
    const file = newestCsv();
    const text = fs.readFileSync(path.join(DIR, file), "utf8");
    console.log(`  TX: reading imports/${file}`);
    return parse(text);
  },
  parse // exported for testing
};
