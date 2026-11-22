// Fetches live opportunities from the SAM.gov Opportunities API and writes live-data.js,
// which index.html loads in place of the sample RFQs.
//
// Usage (PowerShell):
//   $env:SAM_API_KEY = "your-key"     # key lives ONLY in the environment, never in a file
//   node fetch-sam.js                 # last 30 days of postings
//   node fetch-sam.js --days 14 --max 500
//
// Quota-aware: every SAM.gov request counts against SAM_DAILY_BUDGET (or --budget N; default 10, a personal
// key's limit). Only new postings are searched, each description is read once, and the run stops cleanly at
// the budget and resumes the next day. State is in sam-cache.json and sam-quota.json (git-ignored).
//
// Needs Node 18+ (built-in fetch). No dependencies.

const fs = require("fs");
const path = require("path");

const KEY = process.env.SAM_API_KEY;
if (!KEY) {
  console.error("SAM_API_KEY is not set. Get a free key at https://sam.gov (Account Details > API Key),\nthen set it as an environment variable. Do not put it in any project file.");
  process.exit(1);
}

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? Number(args[i + 1]) : def; };
const DAYS = opt("days", 30);
const MAX = opt("max", 5000); // most new notices added to the cache in one run

// SAM.gov notice types: o = Solicitation, k = Combined Synopsis/Solicitation (where RFQs appear).
const PTYPES = "o,k";
const OUT = path.join(__dirname, "live-sam.js");

// SAM.gov set-aside codes -> what the offeror must hold (shown in the Eligibility column).
const SET_ASIDE = {
  SBA: "Small business", SBP: "Small business",
  "8A": "8(a)", "8AN": "8(a)",
  HZC: "HUBZone", HZS: "HUBZone",
  SDVOSBC: "SDVOSB", SDVOSBS: "SDVOSB",
  WOSB: "WOSB", WOSBSS: "WOSB", EDWOSB: "EDWOSB", EDWOSBSS: "EDWOSB",
  VSA: "Veteran-owned", VSS: "Veteran-owned",
  IEE: "Indian economic enterprise", ISBEE: "Indian small business"
};

const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

function dueParts(iso) {
  // Date-only value (no time): keep the calendar day as given. new Date() would read it as UTC midnight,
  // which is the evening of the previous day in New York.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return { due: String(iso).trim(), dueTime: "No time given" };
  const dt = new Date(iso);
  if (isNaN(dt)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(dt);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(dt);
  return { due: parts, dueTime: time.replace(/ (E[SD]T)$/, " $1") };
}

function toRfq(o) {
  const dp = o.responseDeadLine ? dueParts(o.responseDeadLine) : null;
  if (!dp) return null; // no deadline -> nothing to decide on
  const url = typeof o.uiLink === "string" && /^https:\/\/(www\.)?sam\.gov\//.test(o.uiLink) ? o.uiLink : null;
  if (!url) return null;

  const code = (o.typeOfSetAside || "").trim();
  const requires = code ? (SET_ASIDE[code] ? [SET_ASIDE[code]] : null) : null; // null -> "Unclear"
  const place = o.placeOfPerformance || {};
  // Out of area: work performed outside the USA is hidden. Kept only when the country is missing or US.
  const country = String((place.country && (place.country.code || place.country.name)) || "").trim().toUpperCase();
  if (country && !["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(country)) return null;
  const office = o.officeAddress || {};
  const region = [place.city && place.city.name, place.state && (place.state.code || place.state.name)].filter(Boolean).join(", ")
    || [office.city, office.state].filter(Boolean).join(", ") || "No data";

  const requirements = [];
  if (o.typeOfSetAsideDescription) requirements.push(o.typeOfSetAsideDescription);

  return {
    id: o.noticeId,
    requires,
    scope: "", // not extracted yet -> page shows "No data"
    shall: [],
    title: o.title || "(untitled)",
    category: o.naicsCode ? "NAICS " + o.naicsCode : "No data",
    posted: String(o.postedDate || "").slice(0, 10) || null,
    postedAt: o.postedDate && String(o.postedDate).length > 10 ? String(o.postedDate) : undefined, // with time, when the feed gives one
    due: dp.due,
    dueTime: dp.dueTime,
    level: "Federal",
    agency: o.fullParentPathName ? o.fullParentPathName.split(".").slice(0, 2).join(" / ") : "Unknown agency",
    value: null, // the v2 search API carries no award amount on open notices; estimates are filled in later
    rfqUrl: url,
    details: { region, requirements, restriction: code && requirements.length ? requirements[0] : null, amended: false, contact: require("./contacts").fromSam(o.pointOfContact) }
  };
}

// Vehicles/lists an RFQ may be limited to, found by phrase in the description text.
// Only matches when the text says offerors/quotes must come from the list (reduces false "not eligible").
const VEHICLES = [
  ["GSA Schedule", /(GSA|Federal Supply)\s+(MAS|Multiple Award\s+)?Schedule|\bFSS\b|\bMAS\s+contract/i],
  ["NASA SEWP", /\bSEWP\b/i],
  ["CIO-SP", /\bCIO-?SP\d?\b/i],
  ["Alliant", /\bAlliant\s*\d?\b/i]
];
const LIMIT_CUE = /(only|limited to|restricted to|must (hold|have|be)|shall (hold|have|be)|are (invited|eligible)|holders)/i;
function restrictionsFromText(text) {
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const out = [];
  for (const [label, re] of VEHICLES) {
    // look for the vehicle name within ~120 chars of a limiting phrase
    const g = new RegExp(re.source, "gi"); let m;
    while ((m = g.exec(plain))) {
      const win = plain.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120);
      if (LIMIT_CUE.test(win)) { out.push(label); break; }
    }
  }
  return out;
}
// Attachment download links from a search result (resourceLinks). Only SAM.gov's own hosts are ever sent the API key.
const SAM_HOST = /^https:\/\/([\w-]+\.)*sam\.gov\//i;
const attachmentLinksOf = (o) => (Array.isArray(o.resourceLinks) ? o.resourceLinks : []).filter((u) => typeof u === "string" && SAM_HOST.test(u)).slice(0, 6);
const code0 = (o) => (o.typeOfSetAside || "").trim() && !SET_ASIDE[(o.typeOfSetAside || "").trim()];

// ---- Quota-aware, incremental fetching ----------------------------------------------------------
// SAM.gov limits requests per key per day (about 10 for a personal key, about 1,000 for an entity-linked
// one). Every call below counts against SAM_DAILY_BUDGET (default 10, the personal-key limit).
//  - sam-cache.json keeps every notice already fetched, so a notice's description is fetched ONCE.
//  - Each run asks SAM.gov only for postings since the last completed search.
//  - When the budget is used up (or SAM.gov answers 429) the run stops cleanly, keeps what it has, and the
//    next run (after the daily reset) carries on with the notices still waiting for their description.
// sam-quota.json counts the day's requests (UTC date) so several runs in a day share one budget.

const CACHE_FILE = path.join(__dirname, "sam-cache.json");
const QUOTA_FILE = path.join(__dirname, "sam-quota.json");
const BUDGET = opt("budget", Number(process.env.SAM_DAILY_BUDGET || 10));
const BASE = process.env.SAM_BASE || "https://api.sam.gov"; // overridable only for offline testing
const todayUtc = () => new Date().toISOString().slice(0, 10);

class QuotaHit extends Error {}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { if (e.code !== "ENOENT") console.warn(file + " unreadable, starting fresh: " + e.message); return fallback; }
}
function writeJson(file, obj) { fs.writeFileSync(file + ".tmp", JSON.stringify(obj)); fs.renameSync(file + ".tmp", file); }

const quota = readJson(QUOTA_FILE, {});
if (quota.date !== todayUtc()) { quota.date = todayUtc(); quota.used = 0; }
const left = () => Math.max(0, BUDGET - quota.used);
function spend() { quota.used++; writeJson(QUOTA_FILE, quota); } // written before each call: a crash cannot lose the count
async function samGet(url) {
  if (left() <= 0) throw new QuotaHit("daily budget used");
  spend();
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (res.status === 429) { quota.used = Math.max(quota.used, BUDGET); writeJson(QUOTA_FILE, quota); throw new QuotaHit("SAM.gov answered 429 (its daily limit)"); }
  if (res.status === 401 || res.status === 403) throw new Error("SAM.gov rejected the API key (HTTP " + res.status + ").");
  return res;
}

async function getPage(from, to, offset) {
  const u = new URL(BASE + "/opportunities/v2/search");
  u.search = new URLSearchParams({ api_key: KEY, postedFrom: from, postedTo: to, ptype: PTYPES, limit: "100", offset: String(offset) });
  const res = await samGet(u);
  if (!res.ok) throw new Error("SAM.gov returned HTTP " + res.status);
  return res.json();
}

// Description text plus everything derived from it (restrictions, stated amount, AI read). Mutates r.
async function enrich(r, o, text, AI_KEY) {
  if (!r.details.contact) r.details.contact = require("./contacts").fromText(text); // search result had no point of contact: try the description
  const found = restrictionsFromText(text);
  if (found.length) {
    r.requires = Array.from(new Set((r.requires || []).concat(found)));
    r.details.restriction = r.details.restriction || found.join(", ") + " only";
    found.forEach((f) => { if (r.details.requirements.indexOf(f) < 0) r.details.requirements.push(f); });
  } else if (r.requires == null && !code0(o)) r.requires = []; // text read, no restriction found
  // Look for a stated amount (keyword pass, then AI); values are never inferred from other awards.
  if (r.value == null) {
    let a = require("./stated-amount").statedAmount(text);
    if (!a && AI_KEY) a = await require("./ai-extract").extractAmount(text, AI_KEY).catch(() => null);
    if (a) r.valueEst = { kind: "stated", amount: a.amount, quote: a.quote };
  }
  require("./notice-reader").scanDocs(r, text);
  const ai = AI_KEY ? await require("./notice-reader").readText(text, AI_KEY) : null;
  if (require("./notice-reader").applyRead(r, ai, { mergeRequires: true, statedFields: true })) {
    if (!r.scope) r.scope = require("./plain-scope").plainScope(text);
    return true;
  }
  // No AI read (no key, or too little text): still build a plain-language description from the Description text.
  if (!r.scope) r.scope = require("./plain-scope").plainScope(text);
  return false;
}

// One run at a time. Two runs share sam-cache.json and the quota count, so a second one would overwrite the first's
// work and spend the budget twice. A lock file holds the running process id; a stale one (process gone) is ignored.
const LOCK_FILE = path.join(__dirname, "sam-run.lock");
function takeLock() {
  try {
    const other = Number(fs.readFileSync(LOCK_FILE, "utf8"));
    if (other && other !== process.pid) {
      let alive = false;
      try { process.kill(other, 0); alive = true; } catch (e) { alive = e.code === "EPERM"; }
      if (alive) { console.log(`Another SAM.gov fetch (pid ${other}) is already running; not starting a second one.`); process.exit(0); }
    }
  } catch (_) { /* no lock yet */ }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  process.on("exit", () => { try { if (Number(fs.readFileSync(LOCK_FILE, "utf8")) === process.pid) fs.unlinkSync(LOCK_FILE); } catch (_) {} });
}

(async () => {
  takeLock();
  const today = require("./et-today").etToday();
  const cache = readJson(CACHE_FILE, { searchedThrough: null, resume: null, notices: {} });
  const notices = cache.notices;
  const AI_KEY = process.env.ANTHROPIC_API_KEY;
  // Fill the blanks in this same run. A notice already marked done can still be missing its description (read earlier with
  // no result) or have only the plain-wording fallback while a key is now set. Put each back in the queue ONCE (flags
  // `healed` / `aiTried` stop it looping), so the description loop below reads it with the AI if the key is set,
  // or with the plain-wording fallback if not.
  let healed = 0;
  for (const n of Object.values(notices)) {
    if (!n.descDone || !n.descUrl || n.rfq.due < today) continue;
    const blank = !n.rfq.scope && !n.healed;
    const upgrade = AI_KEY && !n.aiTried && !n.rfq.aiRead;
    if (blank || upgrade) { n.descDone = false; n.tries = 0; if (blank) n.healed = true; healed++; }
  }
  if (healed) console.log(`${healed} already-read notices are missing their description or AI read; they are re-read in this run.`);
  if (!AI_KEY) console.log("ANTHROPIC_API_KEY not set: skipping AI reading (requires/scope/key points stay as basic values).");
  console.log(`SAM.gov budget: ${BUDGET}/day, ${quota.used} used so far today (UTC).`);
  let stopped = null, added = 0, described = 0, aiOk = 0, attRead = 0;

  try {
    // 1. Search for postings since the last completed search. Uses at most a quarter of the day's remaining
    //    budget (at least one request) so descriptions, which carry the detail, are not starved.
    const searchCap = Math.max(1, Math.floor(left() / 4));
    // Notices cached before attachment links were kept need one search over the whole window to pick the links up
    // (cache.linksBackfilled). It resumes across days like any other search.
    const from = cache.resume ? cache.resume.from : cache.searchedThrough && cache.linksBackfilled
      ? new Date(Date.parse(cache.searchedThrough) - 86400000).toISOString().slice(0, 10) // 1 day overlap: catches late postings
      : new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
    let offset = cache.resume ? cache.resume.offset : 0, pages = 0, finished = false;
    if (left() > 0) {
      while (pages < searchCap && added < MAX) {
        const page = await getPage(fmt(new Date(from + "T12:00:00")), fmt(new Date(today + "T12:00:00")), offset);
        pages++;
        const items = page.opportunitiesData || [];
        for (const o of items) {
          const r = toRfq(o);
          if (!r) continue;
          const old = notices[r.id];
          if (!old) {
            notices[r.id] = { rfq: r, descUrl: typeof o.description === "string" && o.description.startsWith(BASE + "/") ? o.description : null, descDone: false, tries: 0, raw: { typeOfSetAside: o.typeOfSetAside || "", links: attachmentLinksOf(o) } };
            added++;
          } else if (r.dueTime === "No time given" && /^(7:00 PM EST|8:00 PM EDT)$/.test(old.rfq.dueTime || "")
            && old.rfq.due === new Date(Date.parse(r.due) - 864e5).toISOString().slice(0, 10)) { // cached by the old date-only bug: correct silently
            Object.assign(old.rfq, { due: r.due, dueTime: r.dueTime });
          } else if (old.rfq.due !== r.due || old.rfq.dueTime !== r.dueTime) { // deadline moved = amended
            Object.assign(old.rfq, { due: r.due, dueTime: r.dueTime }); old.rfq.details.amended = true;
          }
          if (old && !old.raw.links) old.raw.links = attachmentLinksOf(o); // cached before attachments were read
          if (old && !old.rfq.details.contact && r.details.contact) old.rfq.details.contact = r.details.contact; // cached before contacts were collected
        }
        offset += 100;
        if (items.length < 100 || offset >= (page.totalRecords || 0)) { finished = true; cache.searchedThrough = today; cache.resume = null; cache.linksBackfilled = true; }
        else cache.resume = { from, offset }; // pick up at the next page if this run dies, runs out of budget or hits --max
        writeJson(CACHE_FILE, cache); // saved per page: a crash or timeout keeps the pages already paid for
        if (finished) break;
      }
    }

    // 2. Descriptions for notices that have not had one yet, soonest deadline first (newest posting breaks ties), while budget lasts.
    //    The daily cap cannot cover every notice, so spend it where waiting would lose the notice: those closing soonest.
    const pending = Object.values(notices).filter((n) => !n.descDone && n.descUrl && n.rfq.due >= today)
      .sort((a, b) => (a.rfq.due || "").localeCompare(b.rfq.due || "") || (b.rfq.posted || "").localeCompare(a.rfq.posted || ""));
    // Attachments carry the real detail, so part of the day's budget is kept for them while any are waiting.
    const attWaiting = Object.values(notices).some((n) => AI_KEY && n.raw && n.raw.links && n.raw.links.length && !n.attDone && n.rfq.due >= today);
    const reserve = attWaiting ? Math.floor(BUDGET * 0.4) : 0;
    for (const n of pending) {
      if (left() <= reserve) break;
      try {
        const res = await samGet(n.descUrl + (n.descUrl.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(KEY));
        const dj = res.ok ? await res.json().catch(() => null) : null;
        if (dj && typeof dj.description === "string") {
          const aiRead = await enrich(n.rfq, n.raw, dj.description, AI_KEY);
          if (aiRead) aiOk++;
          if (AI_KEY) n.aiTried = true;
          // Done only if the AI read worked or no key is set; otherwise retry next run (up to 3 tries).
          if (aiRead || !AI_KEY || ++n.tries >= 3) n.descDone = true;
          described++;
        } else if (++n.tries >= 3) n.descDone = true; // give up on a notice whose description never loads
      } catch (e) {
        if (e instanceof QuotaHit) throw e;
        console.error("Description/AI read failed for one notice: " + e.message);
        if (++n.tries >= 3) n.descDone = true;
      }
      writeJson(CACHE_FILE, cache); // saved per notice: a kill keeps the requests and AI calls already spent
    }

    // 3. Attachments (the RFQ document itself): PDFs go to the model as they are, Word files become text. Soonest deadline first.
    //    Each download counts against the same daily budget. Needs the AI key (a PDF cannot be read without it).
    if (AI_KEY) {
      const att = require("./attachment-reader");
      const queue = Object.values(notices).filter((n) => n.descDone && n.raw && n.raw.links && n.raw.links.length && !n.attDone && n.rfq.due >= today)
        .sort((a, b) => (a.rfq.due || "").localeCompare(b.rfq.due || ""));
      for (const n of queue) {
        if (left() <= 0) break;
        const got = att.newBag();
        let failed = 0;
        for (const link of n.raw.links) {
          if (att.full(got) || left() <= 0) break;
          try {
            att.absorb(await att.download(link + (link.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(KEY), { fetchFn: (u) => samGet(u) }), link, got);
          } catch (e) {
            if (e instanceof QuotaHit) throw e;
            failed++; // a restricted (login-only) or missing file: skip it, the others may still read
          }
        }
        if (left() <= 0 && !att.asRead(got) && failed < n.raw.links.length) break; // budget ran out before this notice got a fair try: leave it for tomorrow
        const read = att.asRead(got);
        let ok = false;
        if (read) {
          try {
            const text = read.text + "\n\n" + [n.rfq.title, n.rfq.scope].filter(Boolean).join("\n");
            require("./notice-reader").scanDocs(n.rfq, text);
            const ai = await require("./notice-reader").readText(text, AI_KEY, read.pdfs);
            if (require("./notice-reader").applyRead(n.rfq, ai, { mergeRequires: true, statedFields: true })) { n.rfq.attRead = true; ok = true; attRead++; }
            if (n.rfq.value == null && !n.rfq.valueEst) {
              const a = require("./stated-amount").statedAmount(read.text);
              if (a) n.rfq.valueEst = { kind: "stated", amount: a.amount, quote: a.quote };
            }
            const found = restrictionsFromText(read.text);
            if (found.length) n.rfq.requires = Array.from(new Set((n.rfq.requires || []).concat(found)));
          } catch (e) { console.error("Attachment AI read failed for one notice: " + e.message); }
        }
        if (ok || ++n.attTries >= 2) n.attDone = true; // two goes, then stop: most failures are files that need a login
        writeJson(CACHE_FILE, cache);
      }
    }
  } catch (e) {
    if (e instanceof QuotaHit) stopped = e.message;
    else { try { writeJson(CACHE_FILE, cache); } catch (_) { /* best effort */ } throw e; }
  }

  // 3. Drop notices long past due, keep only open ones.
  const weekAgo = require("./et-today").etToday(new Date(Date.now() - 7 * 86400000));
  for (const [id, n] of Object.entries(notices)) if (n.rfq.due < weekAgo) delete notices[id];
  const open = Object.values(notices).filter((n) => n.rfq.due >= today);
  // Values are never inferred from other agencies' awards: drop any such estimate left in the cache from earlier runs.
  for (const n of open) if (n.rfq.valueEst && n.rfq.valueEst.kind === "similar") delete n.rfq.valueEst;
  if (attRead) console.log(`Read the attached documents of ${attRead} notices.`);
  if (AI_KEY && (described || attRead)) { console.log(`AI read ${aiOk} of ${described} new descriptions.`); require("./ai-extract").reportUsage("SAM.gov refresh"); }

  writeJson(CACHE_FILE, cache);
  const rfqs = open.map((n) => n.rfq);
  if (process.env.ANTHROPIC_API_KEY) { await require("./ai-extract").recase(rfqs, process.env.ANTHROPIC_API_KEY); await require("./ai-extract").plainTitle(rfqs, process.env.ANTHROPIC_API_KEY); require("./ai-extract").reportUsage("SAM.gov plain titles"); }
  const waiting = open.filter((n) => !n.descDone && n.descUrl).length;
  const meta = { source: "SAM.gov", fetchedAt: new Date().toISOString(), count: rfqs.length, descriptionsWaiting: waiting, requestsUsedToday: quota.used, dailyBudget: BUDGET, searchComplete: !cache.resume };
  // Write to a temp file then rename, so readers never see a truncated live-sam.js.
  fs.writeFileSync(OUT + ".tmp", "// GENERATED by fetch-sam.js - do not edit. Public SAM.gov data.\n" +
    "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(meta) + ", rfqs: " + JSON.stringify(rfqs, null, 1) + " });\n");
  fs.renameSync(OUT + ".tmp", OUT);
  console.log(`Wrote ${rfqs.length} open opportunities to live-sam.js (${added} new, ${described} descriptions read, ${waiting} still waiting).`);
  console.log(`Requests used today: ${quota.used}/${BUDGET}.` + (stopped ? ` Stopped early: ${stopped}. The rest continues on the next run after the daily reset.` : ""));
})().catch((e) => { console.error(e.message); process.exit(1); });
