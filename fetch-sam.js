// Fetches live opportunities from the SAM.gov Opportunities API and writes live-data.js,
// which index.html loads in place of the sample RFQs.
//
// Usage (PowerShell):
//   $env:SAM_API_KEY = "your-key"     # key lives ONLY in the environment, never in a file
//   node fetch-sam.js                 # last 30 days of postings
//   node fetch-sam.js --days 14 --max 500
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
const MAX = opt("max", 300);

// SAM.gov notice types: o = Solicitation, k = Combined Synopsis/Solicitation (where RFQs appear).
const PTYPES = "o,k";
const OUT = path.join(__dirname, "live-sam.js");

// SAM.gov set-aside codes -> what the offeror must hold (matched against COMPANY.holds in data.js).
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
  const office = o.officeAddress || {};
  const region = [place.city && place.city.name, place.state && (place.state.code || place.state.name)].filter(Boolean).join(", ")
    || [office.city, office.state].filter(Boolean).join(", ") || "No data";
  const amount = o.award && Number(String(o.award.amount || "").replace(/[^0-9.]/g, ""));

  const requirements = [];
  if (o.typeOfSetAsideDescription) requirements.push(o.typeOfSetAsideDescription);

  return {
    id: o.noticeId,
    requires,
    scope: "", // not extracted yet -> page shows "No data"
    shall: [],
    title: o.title || "(untitled)",
    category: o.naicsCode ? "NAICS " + o.naicsCode : "No data",
    posted: String(o.postedDate || "").slice(0, 10) || dp.due,
    due: dp.due,
    dueTime: dp.dueTime,
    level: "Federal",
    agency: o.fullParentPathName ? o.fullParentPathName.split(".").slice(0, 2).join(" / ") : "Unknown agency",
    value: amount > 0 ? amount : null,
    rfqUrl: url,
    details: { region, requirements, restriction: code && requirements.length ? requirements[0] : null, amended: false }
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
const code0 = (o) => (o.typeOfSetAside || "").trim() && !SET_ASIDE[(o.typeOfSetAside || "").trim()];

async function getPage(from, to, offset) {
  const u = new URL("https://api.sam.gov/opportunities/v2/search");
  u.search = new URLSearchParams({ api_key: KEY, postedFrom: from, postedTo: to, ptype: PTYPES, limit: "100", offset: String(offset) });
  const res = await fetch(u);
  if (res.status === 429) throw new Error("SAM.gov rate limit hit. Try again later (daily request quota reached).");
  if (res.status === 401 || res.status === 403) throw new Error("SAM.gov rejected the API key (HTTP " + res.status + ").");
  if (!res.ok) throw new Error("SAM.gov returned HTTP " + res.status);
  return res.json();
}

(async () => {
  const to = new Date(), from = new Date(Date.now() - DAYS * 86400000);
  const all = [];
  for (let offset = 0; all.length < MAX; offset += 100) {
    const page = await getPage(fmt(from), fmt(to), offset);
    const items = page.opportunitiesData || [];
    all.push(...items);
    if (items.length < 100 || all.length >= (page.totalRecords || 0)) break;
  }
  const picked = all.slice(0, MAX);
  const rfqs = [];
  const AI_KEY = process.env.ANTHROPIC_API_KEY;
  if (!AI_KEY) console.log("ANTHROPIC_API_KEY not set: skipping AI reading (requires/scope/key points stay as basic values).");
  let aiOk = 0;
  for (const o of picked) {
    const r = toRfq(o);
    if (!r) continue;
    if (typeof o.description === "string" && /^https:\/\/api\.sam\.gov\//.test(o.description)) {
      try {
        const dres = await fetch(o.description + (o.description.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(KEY));
        const dj = dres.ok ? await dres.json().catch(() => null) : null;
        // Keyword pass (no AI needed): flag well-known vehicle restrictions in the description text.
        if (dj && typeof dj.description === "string") {
          const found = restrictionsFromText(dj.description);
          if (found.length) {
            r.requires = Array.from(new Set((r.requires || []).concat(found)));
            r.details.restriction = r.details.restriction || found.join(", ") + " only";
            found.forEach((f) => { if (r.details.requirements.indexOf(f) < 0) r.details.requirements.push(f); });
          } else if (r.requires == null && !code0(o)) r.requires = []; // text read, no restriction found
        }
        const ai = AI_KEY && dj && dj.description ? await require("./ai-extract").extract(dj.description, AI_KEY) : null;
        if (ai) {
          // requires: AI list plus any mapped set-aside. AI "null" (unsure) keeps the set-aside answer, else stays Unclear.
          const base = r.requires || [];
          if (ai.requires !== null) r.requires = Array.from(new Set(base.concat(ai.requires)));
          else if (!base.length) r.requires = null;
          if (ai.scope) r.scope = ai.scope;
          if (ai.shall.length) r.shall = ai.shall;
          r.aiRead = true;
          aiOk++;
        }
      } catch (e) { console.error("AI read failed for one notice: " + e.message); }
    }
    rfqs.push(r);
  }
  if (AI_KEY) console.log(`AI read ${aiOk} of ${rfqs.length} notices.`);
  const meta = { source: "SAM.gov", fetchedAt: new Date().toISOString(), count: rfqs.length };
  fs.writeFileSync(OUT, "// GENERATED by fetch-sam.js - do not edit. Public SAM.gov data.\n" +
    "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: " + JSON.stringify(meta) + ", rfqs: " + JSON.stringify(rfqs, null, 1) + " });\n");
  console.log(`Wrote ${rfqs.length} opportunities (of ${all.length} fetched) to live-sam.js`);
})().catch((e) => { console.error(e.message); process.exit(1); });
