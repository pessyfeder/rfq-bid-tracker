// Estimated dollar values for federal (SAM.gov) notices, from similar past awards on USAspending.gov.
// Public API, no key needed. Same shape as the NYC estimate (valueEst.kind = "similar"), plus source: "usaspending".
//
// Used two ways:
//   - fetch-sam.js calls addEstimates(rfqs) before writing live-sam.js
//   - node sam-estimates.js   refreshes the estimates inside the existing live-sam.js (no SAM key needed)

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const YEARS = 3;          // how far back past awards look
const MIN_SIMILAR = 5;    // fewer awards than this and we show "Not published" instead
const PER_NAICS = 200;    // most recent awards pulled per NAICS code (2 pages of 100)
const AWARD_TYPES = ["A", "B", "C", "D"]; // BPA calls, purchase orders, delivery orders, definitive contracts

const STOP = new Set(("services service contract contracts request requests proposal proposals solicitation notice " +
  "provide providing provision various support supply supplies other general related including include required " +
  "requirements purchase order quote quotation combined synopsis federal national department").split(" "));
function keywords(text) {
  const out = new Set();
  for (const w of String(text || "").toLowerCase().split(/[^a-z]+/)) {
    if (w.length < 4 || STOP.has(w)) continue;
    out.add(w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return out;
}

function percentile(sorted, p) {
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
// 2 significant figures, so a range does not look more precise than it is.
const round2 = (n) => { const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / m) * m; };

async function awardsForNaics(naics) {
  const since = new Date(Date.now() - YEARS * 365 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (let page = 1; page <= PER_NAICS / 100; page++) {
    const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: { award_type_codes: AWARD_TYPES, naics_codes: [naics], time_period: [{ start_date: since, end_date: today }] },
        fields: ["Award ID", "Recipient Name", "Award Amount", "Description", "Start Date", "generated_internal_id"],
        sort: "Start Date", order: "desc", limit: 100, page
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error("USAspending returned HTTP " + res.status);
    const j = await res.json();
    for (const r of j.results || []) {
      const amount = Number(r["Award Amount"]);
      if (!(amount > 0) || !r["Start Date"]) continue;
      out.push({
        title: r.Description || r["Award ID"], vendor: r["Recipient Name"] || "", amount, date: r["Start Date"],
        url: "https://www.usaspending.gov/award/" + encodeURIComponent(r.generated_internal_id), kw: keywords(r.Description)
      });
    }
    if (!(j.page_metadata && j.page_metadata.hasNext)) break;
  }
  return out;
}

function summarize(list, basis, words) {
  const amts = list.map((a) => a.amount).sort((a, b) => a - b);
  return {
    kind: "similar", source: "usaspending", basis, keywords: words, n: list.length, years: YEARS,
    low: round2(percentile(amts, 0.25)), median: round2(percentile(amts, 0.5)), high: round2(percentile(amts, 0.75)),
    examples: list.slice(0, 5).map(({ title, vendor, amount, date, url }) => ({ title, vendor, amount, date, url }))
  };
}

// Tiers: awards with the same NAICS whose description shares keywords with this title; else all recent awards with that NAICS.
function estimate(rfq, awards) {
  const mine = keywords(rfq.title);
  const need = mine.size >= 3 ? 2 : 1;
  if (mine.size) {
    const hit = awards.map((a) => ({ a, hits: [...a.kw].filter((w) => mine.has(w)) })).filter((x) => x.hits.length >= need)
      .sort((x, y) => y.hits.length - x.hits.length);
    if (hit.length >= MIN_SIMILAR) return summarize(hit.map((x) => x.a), "naics+keywords", [...new Set(hit.flatMap((x) => x.hits))].slice(0, 6));
  }
  return awards.length >= MIN_SIMILAR ? summarize(awards, "naics", []) : null;
}

// `failed` (optional Set) receives the rfqs whose USAspending lookup errored, so callers can retry them later
// instead of treating them as done.
async function addEstimates(rfqs, failed) {
  const todo = rfqs.filter((r) => r.level === "Federal" && r.value == null && !r.valueEst && /^NAICS \d{6}$/.test(r.category || ""));
  const codes = [...new Set(todo.map((r) => r.category.slice(6)))];
  const cache = new Map();
  for (let i = 0; i < codes.length; i += 4) {
    await Promise.all(codes.slice(i, i + 4).map(async (c) => {
      try { cache.set(c, await awardsForNaics(c)); } catch (e) { console.warn("USAspending lookup failed for NAICS " + c + ": " + e.message); }
    }));
  }
  let n = 0;
  for (const r of todo) {
    const awards = cache.get(r.category.slice(6));
    if (!awards && failed) failed.add(r);
    const est = awards && estimate(r, awards);
    if (est) { r.valueEst = est; n++; }
  }
  console.log(`USAspending estimates for ${n} of ${todo.length} federal notices`);
  return n;
}

module.exports = { addEstimates, awardsForNaics, estimate };

// CLI: refresh the estimates in the existing live-sam.js
if (require.main === module) {
  const file = path.join(__dirname, "live-sam.js");
  const src = fs.readFileSync(file, "utf8");
  const pushed = [];
  vm.runInNewContext(src, { window: { LIVE_SOURCES: { push: (x) => pushed.push(x) } } });
  const src0 = pushed[0];
  if (!src0) { console.error("live-sam.js has no data"); process.exit(1); }
  addEstimates(src0.rfqs).then(() => {
    fs.writeFileSync(file, "// GENERATED by fetch-sam.js - do not edit. Public SAM.gov data.\n" +
      "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(src0.meta) + ", rfqs: " + JSON.stringify(src0.rfqs, null, 1) + " });\n");
    console.log("Updated live-sam.js");
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
