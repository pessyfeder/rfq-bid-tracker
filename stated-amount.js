// Keyword pass (no AI, no key needed) for a contract amount that the notice itself states.
// Conservative on purpose: a dollar figure only counts if a value/budget/ceiling phrase sits right before it,
// it is not a bond, fee, deposit, wage etc., and the notice does not give conflicting figures.
// Returns { amount, quote } (quote copied from the notice) or null.

const CUE = /(not[- ]to[- ]exceed|\bNTE\b|(estimated|anticipated|approximate|expected|total|maximum|ceiling|contract|award|project|program|funding|budget)\s*(contract\s*|award\s*|total\s*|annual\s*)?(value|amount|cost|price|budget|ceiling|funding|funds)|budget(ed)?\s*(of|is|at|:)|ceiling\s*(of|is|at|:)|funds? available|value of (the|this) (contract|award|project))/i;
const NOT_CONTRACT = /(bond|fee|deposit|insurance|liabilit|wage|hourly|per hour|\/hr|per diem|liquidated|penalt|retain|retainage|prior contract|previous|formerly|last year|expired|refund|document|plans? and spec)/i;
const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\s?(million|billion|thousand|M\b|K\b))?/gi;

function strip(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function statedAmount(html) {
  const text = strip(html).slice(0, 60000);
  const hits = [];
  let m;
  MONEY.lastIndex = 0;
  while ((m = MONEY.exec(text))) {
    let amount = Number(m[1].replace(/,/g, "") + (m[2] || ""));
    const unit = (m[4] || "").toLowerCase();
    if (unit === "million" || unit === "m") amount *= 1e6;
    else if (unit === "billion") amount *= 1e9;
    else if (unit === "thousand" || unit === "k") amount *= 1e3;
    if (!(amount >= 1000)) continue;
    // sentence-ish window around the figure
    const sent = text.lastIndexOf(". ", m.index);
    const start = Math.max(sent < 0 ? 0 : sent + 2, m.index - 160);
    const endIdx = text.indexOf(". ", m.index + m[0].length);
    const end = Math.min(endIdx < 0 ? text.length : endIdx + 1, m.index + m[0].length + 100);
    const before = text.slice(start, m.index);
    const quote = text.slice(start, end).trim();
    if (!CUE.test(before.slice(-100)) || NOT_CONTRACT.test(quote)) continue;
    hits.push({ amount, quote: quote.slice(0, 300) });
  }
  if (!hits.length) return null;
  if (new Set(hits.map((h) => h.amount)).size > 1) return null; // conflicting figures: don't guess
  return hits[0];
}

module.exports = { statedAmount };
