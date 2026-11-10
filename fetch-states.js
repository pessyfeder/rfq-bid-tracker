// State procurement portals -> live-states.js (same shape as the NYC and SAM feeds).
// One adapter per state in states/. A failing state does not stop the others, and its previous
// notices are carried over from the last good live-states.js so they do not vanish from the feed.
//
//   node fetch-states.js            run every adapter
//   node fetch-states.js DE NV      run only these states (others are carried over)
//
// Adding a state: write an adapter { code, name, fetch() } in states/ and list it in ADAPTERS below.
// Sources and their status: state-sources-survey.md.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { clean } = require("./states/common");

const OUT = path.join(__dirname, "live-states.js");
const ADAPTERS = [require("./states/delaware"), require("./states/indiana"), ...require("./states/bso")];

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

function toRfq(n, a) {
  if (!n || !n.id || !isDate(n.due)) return null; // no deadline -> nothing to decide on
  const url = typeof n.url === "string" && /^https:\/\//.test(n.url) ? n.url : null; // never link javascript:/data:
  if (!url) return null;
  const warnings = [];
  if (isDate(n.posted) && Date.now() - new Date(n.posted).getTime() > 365 * 86400000) warnings.push("Posted over a year ago");
  return {
    id: `${a.code}-${n.id}`,
    requires: null, // restrictions not read -> "Unclear"
    scope: clean(n.description),
    shall: [],
    title: clean(n.title) || "(untitled)",
    category: clean(n.category) || "No data",
    posted: isDate(n.posted) ? n.posted : n.due,
    due: n.due,
    dueTime: n.dueTime || "No data",
    level: "State",
    agency: clean(n.agency) || a.name + " agency",
    value: null,
    naics: n.naics || null, // internal: dropped before writing; only used to look up the estimate
    rfqUrl: url,
    details: { region: clean(n.region) || a.name, requirements: [], restriction: null, amended: false, warnings }
  };
}

// Estimated value from similar past awards (USAspending), looked up by the NAICS prefix mapped from the notice's UNSPSC codes.
// Same shape as the federal estimate; best effort, a failed lookup just leaves "Not published".
async function addStateEstimates(list) {
  const { awardsForNaics, estimate } = require("./sam-estimates");
  const cache = new Map();
  let n = 0;
  for (const r of list) {
    const code = r.naics; delete r.naics;
    if (!code) continue;
    if (!cache.has(code)) {
      try { cache.set(code, await awardsForNaics(code)); } catch (e) { console.warn(`USAspending lookup failed for NAICS ${code}: ${e.message}`); cache.set(code, null); }
    }
    const awards = cache.get(code);
    const est = awards && estimate(r, awards);
    if (est) { r.valueEst = { ...est, naics: code }; n++; }
  }
  if (cache.size) console.log(`  value estimates for ${n} of ${list.length} (NAICS lookups: ${[...cache.keys()].join(", ")})`);
}

function readPrevious() {
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(OUT, "utf8"), sandbox, { timeout: 10000 }); // our own generated file
    const entry = (sandbox.window.LIVE_SOURCES || [])[0];
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  } catch { return null; }
}

(async () => {
  const wanted = process.argv.slice(2).map((s) => s.toUpperCase());
  const today = new Date().toISOString().slice(0, 10);
  const prev = readPrevious();
  const prevStates = (prev && prev.meta && prev.meta.states) || {};
  const results = {};
  let rfqs = [];
  const okNow = new Set(); // states fetched successfully in THIS run

  for (const a of ADAPTERS) {
    if (wanted.length && !wanted.includes(a.code)) { results[a.code] = prevStates[a.code] || { ok: false, error: "not run" }; continue; }
    try {
      const raw = await a.fetch();
      const seen = new Set();
      const mine = raw.map((n) => toRfq(n, a)).filter((r) => {
        if (!r || r.due < today || seen.has(r.id)) return false;
        seen.add(r.id); return true;
      });
      await addStateEstimates(mine);
      rfqs = rfqs.concat(mine);
      okNow.add(a.code);
      results[a.code] = { ok: true, count: mine.length, fetchedAt: new Date().toISOString() };
      console.log(`${a.code}: ${mine.length} open (of ${raw.length} read)`);
    } catch (e) {
      results[a.code] = { ...(prevStates[a.code] || {}), ok: false, error: String(e.message).slice(0, 200) };
      console.error(`${a.code}: FAILED - ${e.message}`);
    }
  }
  // Carry over previous notices for states that did not succeed this time (still-future deadlines only).
  if (prev) {
    for (const r of prev.rfqs) {
      const code = String(r.id).split("-")[0];
      if (!okNow.has(code) && r.due >= today) rfqs.push(r);
    }
  }
  if (!okNow.size) { console.error("No state fetched successfully; leaving live-states.js unchanged."); process.exit(1); }

  const meta = { source: "State procurement portals", fetchedAt: new Date().toISOString(), count: rfqs.length, states: results };
  const tmp = OUT + ".tmp";
  fs.writeFileSync(tmp, "// GENERATED by fetch-states.js - do not edit. Public state procurement notices.\n" +
    "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(meta) + ", rfqs: " + JSON.stringify(rfqs, null, 1) + " });\n");
  fs.renameSync(tmp, OUT);
  console.log(`Wrote ${rfqs.length} State solicitations to live-states.js`);
})().catch((e) => { console.error(e.message); process.exit(1); });
