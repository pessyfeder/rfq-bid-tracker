// Turns the fetchers' live-*.js files into a machine-readable feed.
//
// The fetchers are unchanged: each still writes live-<source>.js (a browser script). This module reads
// those files, normalizes every request into a stable schema (FEED.md), and keeps a small state file so
// a consumer can ask "what changed since I last looked" (seq cursor), see which requests dropped out
// (active:false), and never see the same request twice under different content.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SCHEMA_VERSION = 1;
const KEEP_INACTIVE_DAYS = 90;

// Sources the service knows about. `script` is the fetcher; `needsEnv` is checked before scheduling it.
// NYS has no live source yet (see fetch-ny-state.js): it is read if its file exists but never scheduled.
const SOURCES = [
  { id: "nyc", label: "NYC City Record", file: "live-nyc.js", script: "fetch-nyc.js", needsEnv: [] },
  // windowed: the fetch only looks back N days, so absence from it does not mean withdrawn.
  { id: "sam", label: "SAM.gov", file: "live-sam.js", script: "fetch-sam.js", needsEnv: ["SAM_API_KEY"], windowed: true },
  { id: "nys", label: "NYS Contract Reporter", file: "live-ny-state.js", script: null, needsEnv: [] },
  // DE, IN, NV, NJ, OR, IL, MA (one adapter per state in states/; a failing state keeps its last notices).
  { id: "states", label: "State portals (DE, IN, NV, NJ, OR, IL, MA, TX by CSV import)", file: "live-states.js", script: "fetch-states.js", needsEnv: [] }
];

// ---- reading the fetchers' output ------------------------------------------------------------
function readLiveFile(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(p, "utf8"), sandbox, { timeout: 10000 }); // our own generated file
  const entry = (sandbox.window.LIVE_SOURCES || [])[0];
  if (!entry || !Array.isArray(entry.rfqs)) return null;
  return JSON.parse(JSON.stringify(entry)); // detach from the vm context
}

// ---- normalization ---------------------------------------------------------------------------
const etFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hourCycle: "h23",
  year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"
});
function etWallClock(ms) {
  const p = Object.fromEntries(etFmt.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}
// "2026-11-23" + "3:30 PM EST" -> ISO instant. Fetchers publish Eastern-time wall clocks.
function dueInstant(due, dueTime) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due || "");
  const t = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(dueTime || "");
  if (!d || !t) return null;
  let h = Number(t[1]) % 12; if (/pm/i.test(t[3])) h += 12;
  const want = Date.UTC(+d[1], +d[2] - 1, +d[3], h, +t[2]);
  let guess = want;
  for (let i = 0; i < 2; i++) guess += want - etWallClock(guess); // converge on the right DST offset
  return new Date(guess).toISOString();
}

function normalizeValue(r) {
  if (typeof r.value === "number" && r.value > 0) return { amount: r.value, basis: "published", low: null, high: null, note: null };
  const e = r.valueEst;
  if (e && e.kind === "stated" && e.amount > 0) return { amount: e.amount, basis: "stated", low: null, high: null, note: e.quote || null };
  if (e && e.kind === "similar" && e.median > 0) {
    return { amount: e.median, basis: "similar_awards", low: e.low ?? null, high: e.high ?? null, note: `${e.n} similar awards (${e.source || "city record"}), ${e.basis}` };
  }
  return { amount: null, basis: "none", low: null, high: null, note: null };
}

function normalize(r, source) {
  const warnings = (r.details && r.details.warnings) || [];
  const year = Number((r.due || "").slice(0, 4));
  const placeholder = !(year > 0) || year >= 2099 || Date.parse(r.due) - Date.now() > 3 * 365 * 86400000;
  const requires = Array.isArray(r.requires) ? r.requires : null;
  return {
    id: r.id,
    source: source.id,
    level: r.level,                       // Federal | State | Local
    title: r.title,
    agency: r.agency,
    category: r.category,
    region: (r.details && r.details.region) || null,
    posted: r.posted,
    due: r.due,                           // YYYY-MM-DD, Eastern
    dueTime: r.dueTime || null,           // as published, e.g. "3:30 PM EST"
    dueAt: dueInstant(r.due, r.dueTime),  // ISO UTC instant, or null if no usable time
    hasRealDeadline: !placeholder,
    warnings,                             // e.g. "Posted over a year ago"
    url: r.rfqUrl,
    scope: r.scope || "",
    requires,                             // [] = open to all; null = not read (unknown)
    restriction: (r.details && r.details.restriction) || null,
    requirements: (r.details && r.details.requirements) || [],
    shall: Array.isArray(r.shall) ? r.shall : [],
    amended: !!(r.details && r.details.amended),
    aiRead: !!r.aiRead,                   // true = scope/requires/shall were read by AI: verify
    value: normalizeValue(r)
  };
}

const hashOf = (o) => crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

// ---- state -----------------------------------------------------------------------------------
function emptyState() { return { schemaVersion: SCHEMA_VERSION, seq: 0, records: {}, sources: {} }; }

function loadState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    if (s && s.records) return s;
  } catch (e) { if (e.code !== "ENOENT") console.error("state file unreadable, starting empty: " + e.message); }
  return emptyState();
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file); // nobody sees a half-written file
}

// Merge the current live-*.js contents into state. Returns { added, changed, deactivated }.
// A source's live file is only trusted when it is newer than what we last ingested (a failed fetch
// leaves the old file in place, and re-ingesting it would be a no-op anyway).
function ingest(state, now = new Date()) {
  const stats = { added: 0, changed: 0, deactivated: 0 };
  const nowIso = now.toISOString();
  for (const src of SOURCES) {
    let live;
    try { live = readLiveFile(src.file); } catch (e) { console.error(`${src.file} unreadable: ${e.message}`); continue; }
    if (!live) continue;
    const st = state.sources[src.id] = state.sources[src.id] || {};
    st.label = src.label;
    if (st.fetchedAt === live.meta.fetchedAt) continue; // nothing new from this source
    st.fetchedAt = live.meta.fetchedAt;
    st.count = live.rfqs.length;
    // Quota-limited sources report a backlog: requests whose description has not been read yet.
    for (const k of ["descriptionsWaiting", "requestsUsedToday", "dailyBudget", "searchComplete"]) if (live.meta[k] !== undefined) st[k] = live.meta[k];

    const seen = new Set();
    for (const raw of live.rfqs) {
      if (!raw || !raw.id) continue;
      const rec = normalize(raw, src);
      seen.add(rec.id);
      const h = hashOf(rec);
      const old = state.records[rec.id];
      if (!old) {
        state.records[rec.id] = { ...rec, firstSeen: nowIso, lastSeen: nowIso, updatedAt: nowIso, active: true, seq: ++state.seq, _h: h };
        stats.added++;
      } else if (old._h !== h || !old.active) {
        Object.assign(old, rec, { lastSeen: nowIso, updatedAt: nowIso, active: true, seq: ++state.seq, _h: h });
        stats.changed++;
      } else {
        old.lastSeen = nowIso; // unchanged: no new seq, so incremental clients see nothing
      }
    }
    // Present before, gone from this source's latest successful fetch -> tombstone (kept for clients to learn of it).
    for (const rec of Object.values(state.records)) {
      if (rec.source === src.id && rec.active && !seen.has(rec.id)) {
        // Windowed source: keep the record active until its own deadline passes.
        if (src.windowed && (rec.dueAt ? rec.dueAt >= nowIso : rec.due >= nowIso.slice(0, 10))) continue;
        rec.active = false; rec.updatedAt = nowIso; rec.seq = ++state.seq; stats.deactivated++;
      }
    }
  }
  // Drop long-gone records.
  const cutoff = now.getTime() - KEEP_INACTIVE_DAYS * 86400000;
  for (const [id, rec] of Object.entries(state.records)) {
    if (!rec.active && Date.parse(rec.updatedAt) < cutoff) delete state.records[id];
  }
  state.generatedAt = nowIso;
  return stats;
}

// Public view of a record (internal fields removed).
function publicRecord(rec) {
  const { _h, ...rest } = rec;
  return rest;
}

// ---- querying --------------------------------------------------------------------------------
// params: URLSearchParams. See FEED.md for the meaning of each.
function query(state, params) {
  const num = (k) => (params.has(k) && params.get(k) !== "" && !isNaN(Number(params.get(k))) ? Number(params.get(k)) : null);
  const after = num("after");
  const includeInactive = params.get("include_inactive") === "1" || after !== null; // incremental clients need tombstones
  const level = params.get("level"), source = params.get("source");
  const minValue = num("min_value"), maxValue = num("max_value");
  const dueAfter = params.get("due_after"), dueBefore = params.get("due_before");
  const openOnly = params.get("open") !== "0"; // default: hide requests whose deadline has passed
  const realOnly = params.get("real_deadline") === "1";
  const nowIso = new Date().toISOString();

  let list = Object.values(state.records).filter((r) => {
    if (!includeInactive && !r.active) return false;
    if (after !== null && r.seq <= after) return false;
    if (level && r.level.toLowerCase() !== level.toLowerCase()) return false;
    if (source && r.source !== source) return false;
    if (openOnly && r.active && (r.dueAt ? r.dueAt < nowIso : r.due < nowIso.slice(0, 10))) return false;
    if (realOnly && !r.hasRealDeadline) return false;
    if (dueAfter && r.due < dueAfter) return false;
    if (dueBefore && r.due > dueBefore) return false;
    if (minValue !== null && !(r.value.amount >= minValue)) return false;
    if (maxValue !== null && !(r.value.amount <= maxValue)) return false;
    return true;
  });
  list.sort((a, b) => a.seq - b.seq);
  const total = list.length;
  const limit = Math.min(num("limit") || 1000, 5000);
  const page = list.slice(0, limit);
  // `cursor` = highest seq returned; pass it back as ?after= next time. If the page was cut off by
  // `limit`, `more` is true and the next call continues exactly where this one stopped.
  const cursor = page.length ? page[page.length - 1].seq : (after !== null ? after : 0);
  return {
    schemaVersion: SCHEMA_VERSION, generatedAt: state.generatedAt || null,
    count: page.length, total, more: total > page.length, cursor, latestSeq: state.seq,
    rfqs: page.map(publicRecord)
  };
}

module.exports = { SOURCES, SCHEMA_VERSION, loadState, writeAtomic, ingest, query, publicRecord, dueInstant, normalize };
