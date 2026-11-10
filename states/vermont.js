// Vermont: Office of Purchasing & Contracting "Current Bid Listings" (bgs.state.vt.us/pca/bids/bids.php).
// A small static HTML table of the current bids, each linking to its solicitation PDF. No login.
const { http, clean, toEastern } = require("./common");

const PAGE = "https://www.bgs.state.vt.us/pca/bids/bids.php";

const stamp = (s) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s || "");
  if (!m) return null;
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(+m[3], +m[1], +m[2], h, +m[5], "America/New_York");
};

module.exports = {
  code: "VT", name: "Vermont",
  async fetch() {
    const html = await (await http(PAGE)).text();
    if (!/QUESTIONS\s+DUE/i.test(html) || !/DUE\s+DATE/i.test(html)) throw new Error("Page layout not recognised (bid table missing)");
    const out = [];
    for (const tr of html.split(/<tr[^>]*>/i).slice(1)) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (cells.length < 4) continue;
      const link = /<a[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(cells[0]);
      const when = stamp(clean(cells[3]));
      const title = clean(link && link[2]);
      if (!link || !title || !when) continue;
      const url = encodeURI(decodeURI(link[1].trim())).replace(/^http:\/\//i, "https://"); // https only; spaces in file names
      const questions = stamp(clean(cells[1]));
      out.push({
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
        title,
        agency: "Vermont Office of Purchasing & Contracting",
        category: "No data", posted: null,
        due: when.due, dueTime: when.dueTime,
        url,
        description: questions ? `Questions due ${questions.due} ${questions.dueTime}.` : "",
        region: "Vermont"
      });
    }
    if (!out.length) throw new Error("No bids parsed");
    return out;
  }
};
