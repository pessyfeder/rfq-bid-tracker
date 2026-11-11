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
const { clean, requests } = require("./states/common");

const OUT = path.join(__dirname, "live-states.js");
const ADAPTERS = [require("./states/delaware"), require("./states/indiana"), require("./states/iowa"), require("./states/louisiana"), require("./states/mississippi"), require("./states/southcarolina"), require("./states/idaho"), require("./states/vermont"), require("./states/pennsylvania"), require("./states/txdot"), require("./states/rhodeisland"), require("./states/newyork"), require("./states/wyoming"), require("./states/kansas"), require("./states/nebraska"), ...require("./states/bso")];

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
    value: Number.isFinite(n.value) && n.value > 0 ? n.value : null, // only when the source publishes an amount
    valueLabel: n.valueLabel || undefined,
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

// AI read of each notice's page and PDF attachments: fills eligibility (requires), a one-line scope and key
// "shall" points, the same as the NYC/SAM feeds. Needs ANTHROPIC_API_KEY; without it rows stay "Not read".
// Notices already read on an earlier run are reused (no fetch, no cost); MAX_READS caps new reads per run.
const MAX_READS = Number(process.env.STATE_MAX_READS) || 60;
// Bump DOCS_VERSION when states/docs.js learns to reach more documents; rows read before that with no restriction found are read again.
// Version 2: Periscope attachment downloads, Word (.docx) files, Indiana per-event zips.
// Version 3: Mississippi attachments on srm.magic.ms.gov (earlier reads saw only the page header).
const DOCS_VERSION = 3;
const REREAD_STATES = new Set(["NV", "NJ", "OR", "IL", "MA", "SC", "IN", "MS"]);
async function addDocumentReads(list, prevById, adapter) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (adapter && adapter.noPageReads) for (const r of list) { if (adapter.noPageReadsNote) r.details.readNote = adapter.noPageReadsNote; if (adapter.noPageReadsWhy) r.details.readWhy = adapter.noPageReadsWhy; } // shown whether or not a key is set
  if (!key) return;
  const local = adapter && adapter.noPageReads ? adapter.localDoc : null; // portal forbids reads: only files saved by hand
  if (adapter && adapter.noPageReads) {
    if (!local) { console.log(`  ${adapter.code}: page reads skipped (${adapter.noPageReadsWhy || "the portal forbids automated reads"}); rows stay "Not read"`); return; }
  }
  const readNotice = local ? async (url, r) => local(r.id.slice(adapter.code.length + 1)) : require("./states/docs").readNotice;
  const ai = require("./ai-extract");
  let reused = 0, read = 0, budget = MAX_READS, noPage = 0, shortPage = 0, noAnswer = 0, failed = 0, emptyPage = 0, sample = null;
  const refused = {}; // HTTP errors by status, e.g. 401 from the portal
  const todo = [];
  for (const r of list) {
    const p = prevById.get(r.id);
    // A read that found no restriction is redone once when the reader improved (DOCS_VERSION), for states whose attachments it now reaches.
    const stale = p && p.requires == null && (p.docsV || 0) < DOCS_VERSION && REREAD_STATES.has(adapter.code);
    if (p && p.aiRead) { r.requires = p.requires; r.scope = p.scope; r.shall = p.shall; r.aiRead = true; if (p.docsV) r.docsV = p.docsV; } // a failed re-read keeps this
    if (p && p.aiRead && !stale) reused++;
    else if (stale) todo.push(r);
    else if (process.env.STATE_REREAD_ONLY && !(p && p.aiRead)) continue; // re-read only notices that were already read once
    else if (!local || local(r.id.slice(adapter.code.length + 1))) todo.push(r); // local mode: only notices with a saved file
  }
  todo.sort((a, b) => a.due.localeCompare(b.due)); // soonest deadlines first
  // Portals with a bot check (adapter.readPaceMs): one notice at a time with a pause, and stop for this run at the first refusal.
  const pace = (adapter && adapter.readPaceMs) || 0, step = pace ? 1 : 3;
  let botStop = false;
  for (let i = 0; i < todo.length && budget > 0 && !botStop; i += step) {
    if (pace && i > 0) await new Promise((res) => setTimeout(res, pace));
    const batch = todo.slice(i, i + step);
    budget -= batch.length;
    await Promise.all(batch.map(async (r) => {
      try {
        const doc = await readNotice(r.rfqUrl, r);
        if (!doc) { noPage++; return; }
        const res = await ai.extractWithPdfs(doc.text, doc.pdfs, key);
        if (!res) { if (!doc.pdfs.length && ai.plainLength(doc.text) < 200) { if (!sample) sample = { id: r.id, raw: doc.text.length, text: doc.text.replace(/<[^>]*>/g, " ").replace(/[ \t\r\n]+/g, " ").trim().slice(0, 150) }; if (ai.plainLength(doc.text) === 0) emptyPage++; else shortPage++; } else noAnswer++; return; }
        if (res.requires !== null) r.requires = res.requires;
        if (res.scope) r.scope = res.scope;
        if (res.shall.length) r.shall = res.shall;
        r.aiRead = true; r.docsV = DOCS_VERSION; read++;
        if (r.details) delete r.details.readNote;
      } catch (e) {
        const st = /^BOTCHECK/.test(e.message) ? "bot check" : (/HTTP ([45][0-9][0-9])/.exec(e.message) || [])[1];
        if (st) {
          refused[st] = (refused[st] || 0) + 1;
          if (st === "bot check" && pace) botStop = true; // do not keep knocking: the next run tries again
          // A row read on an earlier run keeps that read. Otherwise say so on the row instead of leaving an old "Not stated".
          const p = prevById.get(r.id);
          if (!(p && p.aiRead)) {
            r.aiRead = false; delete r.docsV;
            r.details = { ...(r.details || {}), readNote: `The portal refused the document download (HTTP ${st}), so the documents were not read. The next update retries.` };
          }
        } else { failed++; console.warn(`  read failed for ${r.id}: ${e.message}`); }
      }
    }));
  }
  const refusedN = Object.values(refused).reduce((a, b) => a + b, 0);
  if (noPage || emptyPage || shortPage || noAnswer || failed || refusedN) {
    const parts = [`${noPage} page unreadable/too large`, `${emptyPage} page empty (no text at all)`, `${shortPage} page had 1-199 characters of text`, `${noAnswer} model reply unusable`, `${failed} other errors`];
    for (const [st, n] of Object.entries(refused)) parts.push(st === "bot check" ? `${n} refused by the portal's bot check (not worked around)` : `${n} refused by the portal (HTTP ${st})`);
    console.log(`  not read this run: ${parts.join(", ")}`);
    if (sample) console.log(`  example of a bad page (${sample.id}): ${sample.raw} bytes of HTML, text starts: "${sample.text}"`);
  }
  console.log(`  document reads: ${read} new, ${reused} reused, ${Math.max(0, todo.length - read)} not read yet`);
  ai.reportUsage("State portals");
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
      await addDocumentReads(mine, new Map(((prev && prev.rfqs) || []).map((r) => [r.id, r])), a);
      // A partial run (some result pages blocked) must not drop the notices on the skipped pages: keep last run's rows we did not see.
      if (raw.partialPages && prev) {
        const have = new Set(mine.map((r) => r.id));
        const kept = prev.rfqs.filter((r) => String(r.id).split("-")[0] === a.code && r.due >= today && !have.has(r.id));
        if (kept.length) { mine.push(...kept); console.log(`  ${a.code}: kept ${kept.length} notice(s) from the last run that the skipped pages would have listed`); }
      }
      rfqs = rfqs.concat(mine);
      okNow.add(a.code);
      results[a.code] = { ok: true, count: mine.length, fetchedAt: new Date().toISOString(), ...(raw.partialPages ? { partial: `${raw.partialPages} page(s) skipped` } : {}) };
      if (raw.partialPages) console.error(`${a.code}: PARTIAL - ${raw.partialPages} page(s) could not be read`);
      console.log(`${a.code}: ${mine.length} open (of ${raw.length} read)`);
    } catch (e) {
      results[a.code] = { ...(prevStates[a.code] || {}), ok: false, error: String(e.message).slice(0, 200) };
      console.error(`${a.code}: FAILED - ${e.message}`);
    }
  }
  // Carry over previous notices for states that did not succeed this time (still-future deadlines only).
  const known = new Set(ADAPTERS.map((a) => a.code));
  if (prev) {
    for (const r of prev.rfqs) {
      const code = String(r.id).split("-")[0];
      if (known.has(code) && !okNow.has(code) && r.due >= today) rfqs.push(r); // rows of a removed adapter (TX) are dropped
    }
  }
  if (!okNow.size) { console.error("No state fetched successfully; leaving live-states.js unchanged."); process.exit(1); }

  const meta = { source: "State procurement portals", fetchedAt: new Date().toISOString(), count: rfqs.length, states: results };
  // live-states.js is generated and git-ignored, so keep a dated copy of the last good one before replacing it (newest 10 kept).
  try {
    if (fs.existsSync(OUT)) {
      const dir = path.join(__dirname, "data", "backups");
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(OUT, path.join(dir, "live-states-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".js"));
      for (const f of fs.readdirSync(dir).filter((f) => /^live-states-.*\.js$/.test(f)).sort().slice(0, -10)) fs.unlinkSync(path.join(dir, f));
    }
  } catch (e) { console.warn("  could not back up live-states.js: " + e.message); }
  const tmp = OUT + ".tmp";
  fs.writeFileSync(tmp, "// GENERATED by fetch-states.js - do not edit. Public state procurement notices.\n" +
    "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(meta) + ", rfqs: " + JSON.stringify(rfqs, null, 1) + " });\n");
  fs.renameSync(tmp, OUT);
  console.log(`Wrote ${rfqs.length} State solicitations to live-states.js`);
  console.log(`Requests this run: ${Object.entries(requests).map(([h, n]) => `${h} ${n}`).join(", ") || "none"}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
