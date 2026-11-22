// Coverage check: for each jurisdiction (Federal, NYC, each state) how many open requests have
// eligibility, chips and a description filled in. Read-only: it only reads data/feed.json.
//
//   node check-coverage.js            open, active requests, worst jurisdictions first
//   node check-coverage.js --all      include closed / inactive requests
//   node check-coverage.js --csv      CSV output (for a spreadsheet)
//   node check-coverage.js <file>     read a different feed file
//
// Columns (all percentages of that jurisdiction's requests):
//   Read     docAccess is "read": the documents behind the posting were read
//   Elig     requires is known (not null). [] counts as known: "open to all"
//   Chips    at least one chip: a requires entry, a requirement chip or a restriction
//   Desc     scope (plain-English description) is not empty
//   AI       aiRead: the fields came from the AI reader (not just keyword matches)
const fs = require("fs"), path = require("path");

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const file = args.find((a) => !a.startsWith("--")) || path.join(__dirname, "data", "feed.json");

let feed;
try { feed = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) { console.error("Cannot read " + file + ": " + e.message); process.exit(1); }
let rfqs = Array.isArray(feed) ? feed : feed.rfqs || [];

if (!flag("--all")) {
  const now = Date.now();
  rfqs = rfqs.filter((r) => r.active !== false && !(r.dueAt ? Date.parse(r.dueAt) < now : r.due && Date.parse(r.due + "T23:59:59-05:00") < now));
}

const STATES = { AK: "Alaska", AR: "Arkansas", CO: "Colorado", DE: "Delaware", FL: "Florida", HI: "Hawaii", IA: "Iowa", ID: "Idaho", IL: "Illinois", IN: "Indiana", KS: "Kansas", LA: "Louisiana", MA: "Massachusetts", MO: "Missouri", MS: "Mississippi", NE: "Nebraska", NJ: "New Jersey", NV: "Nevada", NY: "New York", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TXDOT: "Texas (TxDOT)", VT: "Vermont", WV: "West Virginia", WY: "Wyoming" };

// The jurisdiction a record belongs to.
function jurisdiction(r) {
  if (r.source === "sam") return "Federal (SAM.gov)";
  if (r.source === "nyc") return "Local: New York City";
  // Group by the state code in the id (region is sometimes a street address).
  const code = r.id.split(/[-_:]/)[0];
  return "State: " + (STATES[code] || code);
}

const groups = new Map();
for (const r of rfqs) {
  const k = jurisdiction(r);
  const g = groups.get(k) || { name: k, n: 0, read: 0, elig: 0, chips: 0, desc: 0, ai: 0 };
  g.n++;
  if (r.docAccess === "read") g.read++;
  if (Array.isArray(r.requires)) g.elig++;
  if ((r.requires && r.requires.length) || (r.requirements && r.requirements.length) || r.restriction) g.chips++;
  if (r.scope && String(r.scope).trim()) g.desc++;
  if (r.aiRead) g.ai++;
  groups.set(k, g);
}

const pct = (a, n) => (n ? Math.round((100 * a) / n) : 0);
const rows = [...groups.values()].map((g) => ({
  name: g.name, n: g.n,
  read: pct(g.read, g.n), elig: pct(g.elig, g.n), chips: pct(g.chips, g.n), desc: pct(g.desc, g.n), ai: pct(g.ai, g.n)
}));
// Worst first: lowest average of the four fields that matter.
const score = (r) => (r.read + r.elig + r.chips + r.desc) / 4;
rows.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));

const total = { name: "ALL", n: 0, read: 0, elig: 0, chips: 0, desc: 0, ai: 0 };
for (const g of groups.values()) for (const k of Object.keys(total)) if (k !== "name") total[k] += g[k];
const totalRow = { name: "ALL", n: total.n, read: pct(total.read, total.n), elig: pct(total.elig, total.n), chips: pct(total.chips, total.n), desc: pct(total.desc, total.n), ai: pct(total.ai, total.n) };

if (flag("--csv")) {
  console.log("jurisdiction,requests,read_pct,eligibility_pct,chips_pct,description_pct,ai_pct");
  for (const r of [...rows, totalRow]) console.log([JSON.stringify(r.name), r.n, r.read, r.elig, r.chips, r.desc, r.ai].join(","));
  process.exit(0);
}

const w = Math.max(12, ...rows.map((r) => r.name.length));
const line = (r) => r.name.padEnd(w) + String(r.n).padStart(7) + [r.read, r.elig, r.chips, r.desc, r.ai].map((v) => (v + "%").padStart(8)).join("");
console.log("Coverage of " + (flag("--all") ? "all" : "open, active") + " requests in " + path.basename(file) + (feed.dataAsOf ? " (data as of " + feed.dataAsOf + ")" : ""));
console.log("jurisdiction".padEnd(w) + "reqs".padStart(7) + ["Read", "Elig", "Chips", "Desc", "AI"].map((h) => h.padStart(8)).join(""));
console.log("-".repeat(w + 7 + 40));
for (const r of rows) console.log(line(r) + (score(r) < 50 ? "  <- thin" : ""));
console.log("-".repeat(w + 7 + 40));
console.log(line(totalRow));
const thin = rows.filter((r) => score(r) < 50);
if (thin.length) console.log("\n" + thin.length + " jurisdiction(s) under 50% average coverage: " + thin.map((r) => r.name.replace(/^\w+: /, "")).join(", "));
