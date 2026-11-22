// Builds a short plain-language description from a SAM.gov "Description" text, with no AI needed.
// Used when the AI read is unavailable or skipped. Steps: clean the text (HTML, soft hyphens, words split across
// lines such as "la-bor"), drop boilerplate, keep the first sentences, then swap legal/government wording for plain words.

const SWAPS = [
  [/\bthe contractor shall\b/gi, "The contractor must"],
  [/\bthe offeror shall\b/gi, "The bidder must"],
  [/\bcontractor\b/gi, "contractor"],
  [/\boff?erors?\b/gi, "bidders"],
  [/\bshall furnish\b/gi, "must provide"],
  [/\bshall provide\b/gi, "must provide"],
  [/\bshall\b/gi, "must"],
  [/\bfurnish\b/gi, "provide"],
  [/\bpursuant to\b/gi, "under"],
  [/\bin accordance with\b/gi, "following"],
  [/\bprior to\b/gi, "before"],
  [/\bsubsequent to\b/gi, "after"],
  [/\bcommence\b/gi, "start"],
  [/\butilize[sd]?\b/gi, "use"],
  [/\bin the event that\b/gi, "if"],
  [/\bwithin\s+(\d+)\s+miles of\b/gi, "within $1 miles of"],
  [/\bmaterial material\b/gi, "material"] // doubled word seen in source text
];

const ABBR = [
  [/\bJEBLC\b/g, "JEBLC"], // kept: spelled out in the text itself
  [/\bIDIQ\b/g, "indefinite-delivery contract"],
  [/\bMILCON\b/g, "military construction"],
  [/\bPWS\b/g, "performance work statement"],
  [/\bSOW\b/g, "statement of work"]
];

function clean(s) {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#?\w+;/g, " ")
    .replace(/­/g, "")
    .replace(/([a-z])-\s+([a-z])/g, "$1$2") // "la- bor" -> "labor"
    .replace(/\s+/g, " ")
    .trim();
}

// A hyphenated join like "la-bor" has no space after the hyphen in some feeds; fix only when the joined word is not
// a real hyphenated compound. A short left piece with a short right piece (2-4 letters each) is the typical line break.
function fixSplitWords(s) {
  return s.replace(/\b([a-z]{2,4})-([a-z]{2,4})\b/g, (m, a, b) => (/^(la|re|ma|pro|con|sup|ser|equip|fa|ma)$/.test(a) ? a + b : m));
}

// Notes about the notice itself (amendments, Q&A, headers), not about the work.
const NOTICE_NOTE = /^(the )?(answers to all questions|no new questions|bid due date has been|purpose of amendment|amendment (no\.? ?)?\d+|(first|second|third|fourth|fifth) amendment|solicitation number|combined synopsis)|reason for amendment|notice type:|\bamendment (no\.? ?)?\d+ (is|contains|to)\b|\bhas been extended\b/i;

const UNITS = { EA: "each", PM: "units", LB: "pounds", FT: "feet", GL: "gallons", BX: "boxes", PR: "pairs", SE: "sets", KT: "kits", RL: "rolls", HD: "hundreds", YD: "yards" };
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s,\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// DLA parts notices: "Proposed procurement for NSN 123 ITEM NAME: Line 0001 Qty 2 UI EA Deliver To: PLACE By: 0166 DAYS ADO ..."
function dlaScope(text) {
  const m = clean(text).match(/^Proposed procurement for NSN\s+(\d{13})\s+(.+?):\s*(Line\s+\d+.*)$/i);
  if (!m) return "";
  const lines = [...m[3].matchAll(/Line\s+\d+\s+Qty\s+([\d,]+)\s+UI\s+(\w+)(?:\s+Deliver To:\s*(.*?))?\s*By:\s*0*(\d+)\s+DAYS/gi)];
  if (!lines.length) return "";
  const qty = lines.reduce((n, l) => n + Number(l[1].replace(/,/g, "")), 0);
  const unit = UNITS[lines[0][2].toUpperCase()] || "";
  const place = (w) => titleCase(w.replace(/^[A-Z0-9]{4}\s+(?=[A-Z])/, "").replace(/\bDIST\b/g, "Distribution")).replace(/\bDla\b/g, "DLA");
  const where = [...new Set(lines.map((l) => place((l[3] || "").trim())).filter((w) => w))];
  const days = Math.max(...lines.map((l) => Number(l[4])));
  const item = titleCase(m[2].replace(/\s*,\s*/g, ", ")).replace(/(\w)$/, "$1");
  let out = `Defense Logistics Agency wants to buy ${qty.toLocaleString("en-US")}${unit ? " " + unit : ""} of ${item.toLowerCase()} (part number ${m[1]})`;
  if (where.length) out += `, delivered to ${(where.length > 1 ? where[0] + " and others" : where[0])}`;
  if (days) out += `, within ${days} days of award`;
  out += ".";
  if (lines.length > 1) out = out.replace(" of ", ` (${lines.length} line items) of `);
  return out;
}

const BOILER = /^(please see|see attachment|refer to|the government (intends|reserves)|this (is a )?(combined )?synopsis|all responsible|interested (parties|vendors)|responses? (are )?due|questions?\b)/i;

function plainScope(text, max = 240) {
  const dla = dlaScope(text);
  if (dla) return dla;
  let t = fixSplitWords(clean(text));
  if (t.length < 60) return "";
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [t];
  const keep = [];
  let len = 0;
  for (let s of sentences) {
    s = s.trim();
    if (!s || BOILER.test(s) || NOTICE_NOTE.test(s)) continue;
    if (len + s.length > max && keep.length) break;
    keep.push(s);
    len += s.length + 1;
    if (len >= 140) break;
  }
  let out = keep.join(" ");
  if (!out) return "";
  for (const [re, to] of SWAPS) out = out.replace(re, to);
  for (const [re, to] of ABBR) out = out.replace(re, to);
  out = out.replace(/\s+/g, " ").trim();
  out = out.charAt(0).toUpperCase() + out.slice(1);
  if (out.length > max) out = out.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  return out;
}

module.exports = { plainScope, dlaScope, NOTICE_NOTE };
