// Arkansas: Office of State Procurement "Bid Opportunities" (sas.arkansas.gov/procurement/bid-opportunities/).
// ARBuy was retired in July 2026 (state moved to SAP Ariba), so this page is the public list. No login,
// robots.txt allows all (Crawl-delay 10; we make one request). Two server-rendered tables:
//   1. wpDataTable "Current Solicitations" (state agencies): bid number + name, description, posted, deadline
//      (date only), link to an anonymous Ariba RfxEvent preview.
//   2. "Other Procurement Units" (colleges, etc.): description, agency, opening date/time (Central), bid number.
const { http, clean, toEastern } = require("./common");

const PAGE = "https://sas.arkansas.gov/procurement/bid-opportunities/";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const mdy = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

// "November 13, 2026, 9:00 am" (Central) -> Eastern { due, dueTime }
const longStamp = (s) => {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(am|pm))?/i.exec(s || "");
  const mo = m && MONTHS.indexOf(m[1].toLowerCase());
  if (!m || mo < 0) return null;
  if (!m[4]) return { due: `${m[3]}-${String(mo + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`, dueTime: null };
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(+m[3], mo + 1, +m[2], h, +m[5], "America/Chicago");
};

const rowsOf = (html) => html.split(/<tr[\s>]/i).slice(1).map((tr) => [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]));
const href = (cell) => { const m = /<a[^>]*href\s*=\s*"([^"]+)"/i.exec(cell || ""); return m ? m[1].replace(/&amp;/g, "&") : null; };

module.exports = {
  code: "AR", name: "Arkansas",
  async fetch() {
    const html = await (await http(PAGE)).text();
    const tables = html.split(/<table/i).slice(1).map((t) => t.split(/<\/table>/i)[0]);
    const main = tables.find((t) => /<th[^>]*>\s*Response Deadline/i.test(t));
    const other = tables.find((t) => /<th[^>]*>\s*Buyer Email/i.test(t));
    if (!main) throw new Error("Page layout not recognised (Current Solicitations table missing)");
    const out = [];

    for (const c of rowsOf(main)) {
      if (c.length < 9 || /closed|cancel/i.test(clean(c[17] || ""))) continue; // c[17] = Status column
      const first = clean(c[1]);
      const m = /^(\S+)\s+(.+)$/.exec(first);
      const due = mdy(clean(c[4]));
      if (!m || !due) continue;
      const detail = href(c[7]);
      const ariba = href(c[6]);
      out.push({
        id: m[1],
        title: m[2],
        agency: clean(c[5]) || "State of Arkansas",
        category: clean(c[40]) || "No data",
        posted: mdy(clean(c[3])),
        due, dueTime: null,
        url: (ariba || detail || PAGE).replace(/^http:\/\//i, "https://"),
        description: clean(c[2]).replace(/\s*OSP Contact:.*$/i, "").slice(0, 600),
        region: "Arkansas"
      });
    }

    if (other) {
      for (const c of rowsOf(other)) {
        if (c.length < 4) continue;
        const when = longStamp(clean(c[2]));
        const num = clean(c[3]);
        if (!when || !num) continue;
        out.push({
          id: num,
          title: clean(c[0]) || num,
          agency: clean(c[1]) || "Arkansas procurement unit",
          category: "No data", posted: null,
          due: when.due, dueTime: when.dueTime,
          url: (href(c[3]) || PAGE).replace(/^http:\/\//i, "https://"),
          description: "",
          region: "Arkansas"
        });
      }
    }

    if (!out.length) throw new Error("No bids parsed");
    return out;
  }
};
