// Indiana: IDOA "Current Business Opportunities" page. Plain HTML table, no login, one page.
const { http, clean, toEastern } = require("./common");

const PAGE = "https://www.in.gov/idoa/procurement/current-business-opportunities";

module.exports = {
  code: "IN", name: "Indiana",
  async fetch() {
    const html = await (await http(PAGE)).text();
    const i = html.indexOf('id="events-table"');
    if (i < 0) throw new Error("Page layout not recognised (events table missing)");
    const table = html.slice(i, html.indexOf("</table>", i));
    if (!/Event ID/i.test(table) || !/Response Due By/i.test(table)) throw new Error("Expected table columns not found");
    const out = [];
    for (const tr of table.split(/<tr[^>]*>/i).slice(1)) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (cells.length < 5) continue; // header row
      const id = clean(cells[2]);
      const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i.exec(clean(cells[4]));
      if (!id || !m) continue;
      let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
      const when = toEastern(+m[3], +m[1], +m[2], h, +m[5], "America/New_York");
      const title = clean((/<a[^>]*>([\s\S]*?)<\/a>/i.exec(cells[0]) || [])[1]) || "(untitled)";
      out.push({
        id,
        title,
        agency: clean(cells[1]) ? "Indiana " + clean(cells[1]) : "Indiana agency",
        category: "No data",
        posted: null,
        due: when.due, dueTime: when.dueTime,
        url: PAGE, // the page lists every event; its own links are a per-event zip and a generic profile page
        description: ("Event ID " + id + ". " + clean(cells[3])).slice(0, 1500),
        region: "Indiana"
      });
    }
    if (!out.length) throw new Error("No events parsed");
    return out;
  }
};
