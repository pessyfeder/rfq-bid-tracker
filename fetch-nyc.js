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

// Agencies type titles by hand; some are ALL CAPS. Title-case those only (mixed-case titles are left alone).
// Words with no vowel (DHS, NYPD) and a few known acronyms stay upper case.
const SMALL = new Set("a an and as at but by for in of on or the to with".split(" "));
const ACRONYMS = new Set("NYC DOE DOT DEP DSNY HPD EDC MWBE MOCS OTI IT HVAC HRA ACS DOC DOH II III IV".split(" "));
// Learn more acronyms from the data itself: any upper-case token that appears inside a mixed-case title
// (e.g. NYCHA, IDIQ, WWTP) is an acronym, so keep it upper case in all-caps titles too.
function learnAcronyms(titles) {
  for (const t of titles) {
    if (!t || !/[a-z]/.test(t)) continue;
    // Short tokens only: long shouted words in a mixed-case title (MAINTENANCE) are words, not acronyms.
    for (const w of t.match(/\b[A-Z][A-Z0-9&]{1,5}\b/g) || []) if (!SMALL.has(w.toLowerCase())) ACRONYMS.add(w);
  }
}
function tidyTitle(t) {
  if (!t || /[a-z]/.test(t) || !/[A-Z]{2}/.test(t)) return t;
  return t.toLowerCase().replace(/[a-z][a-z'’]*/g, (w, i) => {
    const up = w.toUpperCase();
    if (ACRONYMS.has(up) || !/[aeiouy]/.test(w)) return up;
    if (i > 0 && SMALL.has(w)) return w;
    return w[0].toUpperCase() + w.slice(1);
  });
}

// Notices that pass the "due in the future" filter but are probably not real, current bid opportunities.
function warnings(o) {
  const out = [];
  if (Number(o.due_date.slice(0, 4)) >= 2099) out.push("No real deadline (placeholder date)");
  if (o.start_date && Date.now() - new Date(o.start_date).getTime() > 365 * 86400000) out.push("Posted over a year ago");
  return out;
}

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
    title: tidyTitle(o.short_title) || "(untitled)",
    category: o.category_description || "No data",
    posted: o.start_date ? o.start_date.slice(0, 10) : due,
    due,
    dueTime: time + " ET",
    level: "Local",
    agency: o.agency_name || "NYC agency",
    value: o.contract_amount && Number(o.contract_amount) > 0 ? Number(o.contract_amount) : null,
    rfqUrl: "https://a856-cityrecord.nyc.gov/RequestDetail/" + encodeURIComponent(o.request_id),
    details: { region: "New York City", requirements, restriction: null, amended: false, warnings: warnings(o) }
  };
}

const API = "https://data.cityofnewyork.us/resource/dg92-zbpx.json";
const AWARD_YEARS = 3;   // how far back "similar past awards" look
const MIN_SIMILAR = 3;   // need at least this many same-agency, same-category awards to show a range

// Node's fetch only says "fetch failed"; the real reason (ECONNRESET, ETIMEDOUT, a TLS error, DNS...) is in e.cause.
function describeError(e) {
  if (e && e.name === "TimeoutError") return "timed out";
  const parts = [];
  for (let c = e, depth = 0; c && depth < 4; c = c.cause, depth++) {
    const bit = [c.code, c.message].filter(Boolean).join(" ");
    if (bit && !parts.includes(bit)) parts.push(bit);
  }
  return parts.join(": ") || String(e);
}

const MAX_ATTEMPTS = 6;     // the API drops connections now and then; a brief outage should not fail the whole refresh
const RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
async function socrata(params) {
  const u = new URL(API);
  u.search = new URLSearchParams(params);
  // Retry transient server errors, network failures and dropped downloads, with growing, jittered waits
  // (about 2s, 4s, 8s, 16s, 32s: roughly a minute in all).
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retry = true;
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(90000) });
      if (res.ok) return await res.json(); // reading the body can fail too (connection dropped mid-download)
      lastErr = new Error("NYC Open Data returned HTTP " + res.status);
      retry = RETRY_STATUSES.includes(res.status);
    } catch (e) {
      lastErr = new Error(describeError(e), { cause: e });
    }
    if (!retry || attempt >= MAX_ATTEMPTS) break;
    const wait = Math.round(1000 * 2 ** attempt * (0.75 + Math.random() * 0.5));
    console.warn(`NYC: attempt ${attempt}/${MAX_ATTEMPTS} failed (${lastErr.message}); retrying in ${Math.round(wait / 1000)}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`${lastErr.message} (gave up after ${MAX_ATTEMPTS} attempts)`);
}

// Fetch every matching row by paging with $limit/$offset. A single huge $limit can be silently capped
// by the server, which would drop the oldest rows without any error. A unique tie-break on the sort
// keeps pages from overlapping or skipping rows.
// `maxRows` is a hard cap; `capIsLimit` says it is a deliberate limit (no warning when reached).
async function socrataAll(params, { pageSize = 5000, maxRows = 200000, capIsLimit = false } = {}) {
  const all = [];
  while (all.length < maxRows) {
    const want = Math.min(pageSize, maxRows - all.length);
    const page = await socrata({ ...params, $order: params.$order + ", request_id", $limit: String(want), $offset: String(all.length) });
    all.push(...page);
    if (page.length < want) return all;
  }
  if (!capIsLimit) console.warn(`NYC: stopped at ${maxRows} rows (safety cap); older rows were not loaded`);
  return all;
}

function percentile(sorted, p) {
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
// Round to 2 significant figures so a range does not look more precise than it is.
const round2 = (n) => { const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / m) * m; };

// Keywords from a title: lowercase words, generic procurement words dropped, plural "s" trimmed.
const STOP = new Set(("services service contract contracts request requests proposal proposals bid bids rfp rfq rfei ifb invitation " +
  "solicitation notice provide providing provision various citywide city york nyc department dept agency program programs project projects " +
  "work works for the and with from into that this under per new fiscal year years open ended term general related " +
  "including include required requirements support supply supplies other cons").split(" "));
function keywords(title) {
  const out = new Set();
  for (const w of String(title || "").toLowerCase().split(/[^a-z]+/)) {
    if (w.length < 4 || STOP.has(w)) continue;
    out.add(w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return out;
}

// Past awards (City Record "Award" notices with a contract amount), as a flat list, newest first.
async function loadAwards() {
  const since = new Date(Date.now() - AWARD_YEARS * 365 * 86400000).toISOString().slice(0, 10);
  const rows = await socrataAll({
    $select: "request_id,agency_name,category_description,short_title,vendor_name,contract_amount,start_date",
    // Only awards from open competition (bids / proposals / RFQs). Renewals, sole source, emergency,
    // small purchases etc. are not comparable to a solicitation someone can bid on.
    $where: `section_name='Procurement' AND type_of_notice_description='Award' AND contract_amount>0 AND start_date>='${since}'` +
      ` AND (selection_method_description like 'Competitive Sealed%' OR selection_method_description like 'Request for%')`,
    $order: "start_date DESC"
  });
  const NOT_NEW = /\b(amend\w*|renewal|extension|allowance|increase|change order|modification)\b/i;
  const seen = new Set(), awards = [];
  for (const r of rows) {
    const amount = Number(r.contract_amount);
    if (!r.request_id || seen.has(r.request_id) || !(amount > 0) || NOT_NEW.test(r.short_title || "")) continue;
    seen.add(r.request_id);
    awards.push({
      agency: r.agency_name, category: r.category_description, kw: keywords(r.short_title),
      title: r.short_title || "(untitled)", vendor: r.vendor_name || "", amount, date: r.start_date.slice(0, 10),
      url: "https://a856-cityrecord.nyc.gov/RequestDetail/" + encodeURIComponent(r.request_id)
    });
  }
  return awards;
}

function summarize(list, basis, words) {
  const amts = list.map((a) => a.amount).sort((a, b) => a - b);
  return {
    kind: "similar", basis, keywords: words, n: list.length, years: AWARD_YEARS,
    low: round2(percentile(amts, 0.25)), median: round2(percentile(amts, 0.5)), high: round2(percentile(amts, 0.75)),
    examples: list.slice(0, 5).map(({ title, vendor, amount, date, url }) => ({ title, vendor, amount, date, url }))
  };
}

// Tiers, most specific first; the first with enough awards wins:
//   1. same agency + category, and the award title shares keywords with this bid's title
//   2. same category (any agency), and the title shares keywords with this bid
//   3. same agency + category, no keyword match (broad: typical size of this agency's work)
function similarEstimate(rfq, awards) {
  const mine = keywords(rfq.title);
  const need = mine.size >= 3 ? 2 : 1; // 2 shared keywords, or 1 if the bid's title has very few
  const scored = (pool) => mine.size === 0 ? [] : pool
    .map((a) => ({ a, hits: [...a.kw].filter((w) => mine.has(w)) }))
    .filter((x) => x.hits.length >= need)
    .sort((x, y) => y.hits.length - x.hits.length); // stable: ties stay newest first
  const sameCat = awards.filter((a) => a.category === rfq.category);
  const sameBoth = sameCat.filter((a) => a.agency === rfq.agency);

  for (const [pool, basis] of [[sameBoth, "agency+keywords"], [sameCat, "category+keywords"]]) {
    const hit = scored(pool);
    if (hit.length >= MIN_SIMILAR) {
      const words = [...new Set(hit.flatMap((x) => x.hits))].slice(0, 6);
      return summarize(hit.map((x) => x.a), basis, words);
    }
  }
  return sameBoth.length >= MIN_SIMILAR ? summarize(sameBoth, "agency", []) : null;
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

(async () => {
  const today = require("./et-today").etToday();
  const items = await socrataAll({
    $where: `section_name='Procurement' AND type_of_notice_description='Solicitation' AND due_date >= '${today}'`,
    $order: "start_date DESC"
  }, { maxRows: MAX, capIsLimit: true });
  learnAcronyms(items.map((o) => o.short_title));
  // One malformed row must not abort the whole fetch: skip it and say so.
  const rfqs = items.map((o) => {
    try { return toRfq(o); }
    catch (e) { console.warn(`NYC: skipped row ${o && o.request_id} (${e.message})`); return null; }
  }).filter(Boolean);
  const byId = new Map(items.map((o) => ["NYC-" + o.request_id, o]));

  // Estimate 1 (always tried first): an amount the notice itself states.
  // Keyword pass first (free, needs no key), then the AI read where ANTHROPIC_API_KEY is set.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const noticeText = (r) => { const o = byId.get(r.id); return [o.additional_description_1, o.other_info_1].filter(Boolean).join("\n"); };
  {
    const { statedAmount } = require("./stated-amount");
    let found = 0;
    for (const r of rfqs) {
      if (r.value != null) continue;
      const a = statedAmount(noticeText(r));
      if (a) { r.valueEst = { kind: "stated", amount: a.amount, quote: a.quote }; found++; }
    }
    console.log(`Stated amounts found by keyword pass in ${found} notices`);
  }
  if (apiKey) {
    const { extractAmount } = require("./ai-extract");
    let found = 0;
    await inBatches(rfqs.filter((r) => r.value == null && !r.valueEst), 5, async (r) => {
      try {
        const a = await extractAmount(noticeText(r), apiKey);
        if (a) { r.valueEst = { kind: "stated", amount: a.amount, quote: a.quote }; found++; }
      } catch (e) { console.warn("Amount read failed for " + r.id + ": " + e.message); }
    });
    console.log(`Stated amounts found by AI read in ${found} notices`);

    // AI read of the notice text: fills requires[], a one-line scope and 3-5 key "shall" points,
    // which feed the Bid factors chips (TSA/background checks, bonds, licenses, site visits...).
    const { extract } = require("./ai-extract");
    let read = 0;
    await inBatches(rfqs, 5, async (r) => {
      const o = byId.get(r.id);
      try {
        const ai = await extract([o.short_title, o.additional_description_1, o.other_info_1].filter(Boolean).join("\n"), apiKey);
        if (!ai) return; // too little text: leave as is
        if (ai.requires !== null) r.requires = ai.requires;
        if (ai.scope) r.scope = ai.scope;
        if (ai.shall.length) r.shall = ai.shall;
        if (ai.naics) r.naics = ai.naics;
        if (ai.dueDate) r.docDue = ai.dueDate;
        r.aiRead = true;
        read++;
      } catch (e) { console.warn("AI read failed for " + r.id + ": " + e.message); }
    });
    console.log(`AI read ${read} of ${rfqs.length} notices`);
    require("./ai-extract").reportUsage("NYC refresh");
  } else {
    console.log("ANTHROPIC_API_KEY not set: skipping stated-amount extraction (similar-award estimates still run)");
  }

  // Estimate 2: range from similar past awards, only where there is no published or stated amount.
  // Optional: if the awards query fails, skip only these estimates and still write the feed.
  let similar = 0;
  try {
    const awards = await loadAwards();
    for (const r of rfqs) {
      if (r.value != null || r.valueEst) continue;
      const est = similarEstimate(r, awards);
      if (est) { r.valueEst = est; similar++; }
    }
    console.log(`Similar-award estimates for ${similar} notices`);
  } catch (e) {
    console.warn(`Skipping similar-award estimates (awards query failed): ${e.message}`);
  }

  const meta = { source: "NYC City Record", fetchedAt: new Date().toISOString(), count: rfqs.length };
  // Write to a temp file then rename, so readers never see a truncated live-nyc.js.
  fs.writeFileSync(OUT + ".tmp", "// GENERATED by fetch-nyc.js - do not edit. Public NYC data.\n" +
    "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(meta) + ", rfqs: " + JSON.stringify(rfqs, null, 1) + " });\n");
  fs.renameSync(OUT + ".tmp", OUT);
  console.log(`Wrote ${rfqs.length} NYC solicitations to live-nyc.js`);
})().catch((e) => { console.error(e.message); process.exit(1); });
