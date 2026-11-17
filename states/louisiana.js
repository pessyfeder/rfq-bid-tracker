// Louisiana: LaPAC public "Bids by Category (UNSPSC segment)". Server-rendered HTML tables, no login.
// One request per category (about 40); a bid listed under several categories is de-duplicated by the runner.
const { http, sleep, clean, toEastern } = require("./common");

const unspsc = require("./unspsc");

const BASE ="https://wwwcfprd.doa.louisiana.gov/osp/lapac/";

function parseCategory(html) {
  const cat = clean((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(html) || [])[1]);
  const i = html.indexOf('<table class="bid"');
  if (i < 0) return { cat, rows: [] };
  const rows = [];
  for (const tr of html.slice(i).split(/<tr[^>]*>/i).slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 4) continue;
    const id = clean((/<span[^>]*>([\s\S]*?)<\/span>/i.exec(cells[0]) || [])[1] || cells[0]);
    const desc = clean(cells[1].split(/<strong>\s*Original/i)[0]);
    const pdf = /href="(\/osp\/lapac\/agency\/pdf\/[^"]+)"/i.exec(cells[1]);
    const issued = /(\d{2})\/(\d{2})\/(\d{4})/.exec(clean(cells[2]));
    const open = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i.exec(clean(cells[3]));
    if (!id || !open) continue;
    let h = Number(open[4]) % 12; if (/pm/i.test(open[6])) h += 12;
    rows.push({
      id, desc, pdf: pdf ? "https://wwwcfprd.doa.louisiana.gov" + pdf[1] : null,
      posted: issued ? `${issued[3]}-${issued[1]}-${issued[2]}` : null,
      when: toEastern(+open[3], +open[1], +open[2], h, +open[5], "America/Chicago"),
      dept: clean(cells[4])
    });
  }
  return { cat, rows };
}

module.exports = {
  code: "LA", name: "Louisiana",
  async fetch() {
    const index = await (await http(BASE + "catbids.cfm", { timeoutMs: 60000 }, 3)).text();
    const terms = [...new Set([...index.matchAll(/dspBid\.cfm\?search=segment&(?:amp;)?term=(\d+)/g)].map((m) => m[1]))];
    if (!terms.length) throw new Error("Page layout not recognised (no category links)");
    const out = [];
    let failed = 0;
    for (const t of terms) {
      await sleep(600);
      try {
        const html = await (await http(`${BASE}dspBid.cfm?search=segment&term=${t}`, { timeoutMs: 60000 }, 3)).text();
        const { cat, rows } = parseCategory(html);
        for (const r of rows) {
          if (!r.pdf) continue; // no document to link to
          out.push({
            id: r.id, title: r.desc.length > 200 ? r.desc.slice(0, 197) + "..." : r.desc || "(untitled)",
            agency: "Louisiana" + (r.dept ? " (" + r.dept + ")" : " agency"),
            category: unspsc.category(t) || cat || "No data", posted: r.posted,
            due: r.when.due, dueTime: r.when.dueTime, url: r.pdf, description: r.desc, region: "Louisiana"
          });
        }
      } catch (e) { failed++; if (failed > 3) throw new Error("Too many category pages failed: " + e.message); }
    }
    if (!out.length) throw new Error("No bids parsed");
    return out;
  }
};
