// Fetches open NYC solicitations from the City Record (NYC Open Data, dataset dg92-zbpx)
// and writes live-nyc.js. Public data, no API key needed.
//
// Usage: node fetch-nyc.js [--max 500]

const fs = require("fs");
const path = require("path");

const maxIdx = process.argv.indexOf("--max");
const MAX = maxIdx >= 0 ? Number(process.argv[maxIdx + 1]) : 500;
const OUT = path.join(__dirname, "live-nyc.js");

const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/[\u0000-\u001f]/g, "'").replace(/\s+/g, " ").trim();

function toRfq(o) {
  if (!o.due_date || !o.request_id) return null;
  const due = o.due_date.slice(0, 10);
  const m = o.due_date.slice(11, 16).split(":").map(Number);
  const time = new Date(2000, 0, 1, m[0], m[1]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const scope = stripHtml(o.additional_description_1);
  const requirements = [];
  if (o.selection_method_description) requirements.push(o.selection_method_description);
  if (/mandatory:\s*yes/i.test(o.other_info_1 || "")) requirements.push("Mandatory pre-bid meeting");
  return {
    id: "NYC-" + o.request_id,
    requires: null, // restriction (e.g. M/WBE set-aside) not yet read from the text -> "Unclear"
    scope: scope ? scope : "See the notice on the City Record.",
    shall: [],
    title: o.short_title || "(untitled)",
    category: o.category_description || "No data",
    posted: o.start_date.slice(0, 10),
    due,
    dueTime: time + " ET",
    level: "Local",
    agency: o.agency_name || "NYC agency",
    value: o.contract_amount && Number(o.contract_amount) > 0 ? Number(o.contract_amount) : null,
    rfqUrl: "https://a856-cityrecord.nyc.gov/RequestDetail/" + encodeURIComponent(o.request_id),
    details: { region: "New York City", requirements, restriction: null, amended: false }
  };
}

const API = "https://data.cityofnewyork.us/resource/dg92-zbpx.json";
const AWARD_YEARS = 3;   // how far back "similar past awards" look
const MIN_SIMILAR = 3;   // need at least this many same-agency, same-category awards to show a range

async function socrata(params) {
  const u = new URL(API);
  u.search = new URLSearchParams(params);
  const res = await fetch(u);
  if (!res.ok) throw new Error("NYC Open Data returned HTTP " + res.status);
  return res.json();
}

function percentile(sorted, p) {
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
// Round to 2 significant figures so a range does not look more precise than it is.
const round2 = (n) => { const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / m) * m; };

// Past awards (City Record "Award" notices with a contract amount), grouped by agency + category.
async function loadAwardIndex() {
  const since = new Date(Date.now() - AWARD_YEARS * 365 * 86400000).toISOString().slice(0, 10);
  const rows = await socrata({
    $select: "request_id,agency_name,category_description,short_title,vendor_name,contract_amount,start_date",
    // Only awards from open competition (bids / proposals / RFQs). Renewals, sole source, emergency,
    // small purchases etc. are not comparable to a solicitation someone can bid on.
    $where: `section_name='Procurement' AND type_of_notice_description='Award' AND contract_amount>0 AND start_date>='${since}'` +
      ` AND (selection_method_description like 'Competitive Sealed%' OR selection_method_description like 'Request for%')`,
    $order: "start_date DESC",
    $limit: "50000"
  });
  const NOT_NEW = /\b(amend\w*|renewal|extension|allowance|increase|change order|modification)\b/i;
  const seen = new Set(), index = new Map();
  for (const r of rows) {
    const amount = Number(r.contract_amount);
    if (!r.request_id || seen.has(r.request_id) || !(amount > 0) || NOT_NEW.test(r.short_title || "")) continue;
    seen.add(r.request_id);
    const key = r.agency_name + "||" + r.category_description;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({
      title: r.short_title || "(untitled)", vendor: r.vendor_name || "", amount, date: r.start_date.slice(0, 10),
      url: "https://a856-cityrecord.nyc.gov/RequestDetail/" + encodeURIComponent(r.request_id)
    });
  }
  return index;
}

function similarEstimate(rfq, index) {
  const list = index.get(rfq.agency + "||" + rfq.category);
  if (!list || list.length < MIN_SIMILAR) return null;
  const amts = list.map((a) => a.amount).sort((a, b) => a - b);
  return {
    kind: "similar", n: list.length, years: AWARD_YEARS,
    low: round2(percentile(amts, 0.25)), median: round2(percentile(amts, 0.5)), high: round2(percentile(amts, 0.75)),
    examples: list.slice(0, 5) // most recent first
  };
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const items = await socrata({
    $where: `section_name='Procurement' AND type_of_notice_description='Solicitation' AND due_date >= '${today}'`,
    $order: "start_date DESC",
    $limit: String(MAX)
  });
  const rfqs = items.map(toRfq).filter(Boolean);
  const byId = new Map(items.map((o) => ["NYC-" + o.request_id, o]));

  // Estimate 1: an amount the notice itself states (AI-read; needs ANTHROPIC_API_KEY).
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const { extractAmount } = require("./ai-extract");
    let found = 0;
    await inBatches(rfqs.filter((r) => r.value == null), 5, async (r) => {
      const o = byId.get(r.id);
      try {
        const a = await extractAmount([o.additional_description_1, o.other_info_1].filter(Boolean).join("\n"), apiKey);
        if (a) { r.valueEst = { kind: "stated", amount: a.amount, quote: a.quote }; found++; }
      } catch (e) { console.warn("Amount read failed for " + r.id + ": " + e.message); }
    });
    console.log(`Stated amounts found in ${found} notices`);
  } else {
    console.log("ANTHROPIC_API_KEY not set: skipping stated-amount extraction (similar-award estimates still run)");
  }

  // Estimate 2: range from similar past awards, only where there is no published or stated amount.
  const index = await loadAwardIndex();
  let similar = 0;
  for (const r of rfqs) {
    if (r.value != null || r.valueEst) continue;
    const est = similarEstimate(r, index);
    if (est) { r.valueEst = est; similar++; }
  }
  console.log(`Similar-award estimates for ${similar} notices`);

  const meta = { source: "NYC City Record", fetchedAt: new Date().toISOString(), count: rfqs.length };
  fs.writeFileSync(OUT, "// GENERATED by fetch-nyc.js - do not edit. Public NYC data.\n" +
    "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(meta) + ", rfqs: " + JSON.stringify(rfqs, null, 1) + " });\n");
  console.log(`Wrote ${rfqs.length} NYC solicitations to live-nyc.js`);
})().catch((e) => { console.error(e.message); process.exit(1); });
