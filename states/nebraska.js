// Nebraska: DAS Materiel Purchasing Bureau "Current Bid Opportunities" (das.nebraska.gov/materiel/bid-opportunities.html).
// One server-rendered HTML table, no login, robots.txt does not cover /materiel/. Rows with a date in the
// Opening column are kept; "Continous" (open-ended) rows have no due date and are skipped.
// NIGP codes ("32500 - Feed...") are in the Category column. The old nebraskabuys.com portal no longer resolves.
const { http, clean } = require("./common");

const BASE = "https://das.nebraska.gov";
const iso = (s) => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s || ""); if (!m) return null; const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; };

module.exports = {
  code: "NE", name: "Nebraska",
  async fetch() {
    const html = await (await http(`${BASE}/materiel/bid-opportunities.html`, { timeoutMs: 60000 }, 3)).text();
    const start = html.indexOf('id="current-bid-opportunities"');
    if (start < 0) throw new Error("Page layout not recognised (Current Bid Opportunities section missing)");
    const end = html.indexOf("</table>", start);
    const rows = html.slice(start, end).split(/<tr[\s>]/i).slice(1).filter((r) => /<td/i.test(r));
    if (!rows.length) throw new Error("No bid rows found (portal may have changed)");
    const out = [];
    for (const r of rows) {
      const c = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (c.length < 8) continue;
      const due = iso(clean(c[3]));
      if (!due) continue;
      const href = /href="([^"]+)"/i.exec(c[1]);
      const id = clean(c[6]);
      const cat = clean(c[2]);
      out.push({
        id: id || clean(c[1]),
        title: clean(c[1]),
        agency: clean(c[7]) || "Nebraska agency",
        category: cat || "No data",
        posted: iso(clean(c[0])),
        due, dueTime: null,
        url: href ? new URL(href[1], BASE + "/materiel/").href : `${BASE}/materiel/bid-opportunities.html`,
        description: [clean(c[4]), cat].filter(Boolean).join(" - ") || clean(c[1]),
        region: "Nebraska"
      });
    }
    return out;
  }
};
