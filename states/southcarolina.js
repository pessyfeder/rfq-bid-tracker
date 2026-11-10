// South Carolina: SCEIS "Solicitation Attachments" public search (apps.sceis.sc.gov). No login.
// POST the search form for Open solicitations, then follow the result pages (15 rows each) with the same session.
const { http, sleep, clean, toEastern } = require("./common");

const BASE = "https://apps.sceis.sc.gov/SCSolicitationWeb/";

function parse(html) {
  const rows = [];
  for (const tr of html.split(/<tr[^>]*>/i).slice(1)) {
    const id = /class="solicitNumber"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i.exec(tr);
    const name = /class="solicitName"[^>]*>([\s\S]*?)<\/td>/i.exec(tr);
    const group = /class="group"[^>]*>([\s\S]*?)<\/td>/i.exec(tr);
    const open = /class="openingDate"[^>]*>([\s\S]*?)<\/td>/i.exec(tr);
    if (!id || !open) continue;
    const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i.exec(clean(open[1]));
    if (!m) continue;
    let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
    rows.push({ id: clean(id[1]), title: clean(name && name[1]), agency: clean(group && group[1]), when: toEastern(+m[3], +m[1], +m[2], h, +m[5], "America/New_York") });
  }
  return rows;
}

module.exports = {
  code: "SC", name: "South Carolina",
  async fetch() {
    const jar = new Map();
    const remember = (r) => { for (const c of r.headers.getSetCookie ? r.headers.getSetCookie() : []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
    const cookie = () => [...jar].map(([k, v]) => k + "=" + v).join("; ");

    remember(await http(BASE + "solicitationSearch.do", { timeoutMs: 60000 }, 3));
    const res = await http(BASE + "solicitationSearch.do", { method: "POST", timeoutMs: 60000, headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie() },
      body: new URLSearchParams({ searchNumber: "", searchName: "", searchGroup: "", searchStatus: "O", btnSearch: "Search", searchLimit: "500" }) }, 3);
    remember(res);
    let html = await res.text();
    const found = Number((/(\d+)\s+solicitations found/i.exec(html) || [])[1]);
    if (!Number.isFinite(found)) throw new Error("Page layout not recognised (result count missing)");
    const pager = /d-(\d+)-p=\d+/.exec(html);
    const pages = Math.max(1, ...[...html.matchAll(/d-\d+-p=(\d+)/g)].map((m) => Number(m[1])));
    let all = parse(html);
    for (let p = 2; p <= Math.min(pages, 60); p++) {
      if (!pager) break;
      await sleep(600);
      const r = await http(`${BASE}solicitationSearch.do?d-${pager[1]}-p=${p}`, { timeoutMs: 60000, headers: { Cookie: cookie() } }, 3);
      remember(r);
      const got = parse(await r.text());
      if (!got.length) throw new Error(`Paging stopped at page ${p} of ${pages}`);
      all = all.concat(got);
    }
    if (found > 0 && !all.length) throw new Error("No rows parsed from " + found + " results");
    return all.map((r) => ({
      id: r.id,
      title: r.title.length > 200 ? r.title.slice(0, 197) + "..." : r.title || "(untitled)",
      agency: r.agency ? "South Carolina " + r.agency : "South Carolina agency",
      category: "No data", posted: null,
      due: r.when.due, dueTime: r.when.dueTime,
      url: `${BASE}contractSearch.do?solicitnumber=${encodeURIComponent(r.id)}`,
      description: r.title, region: "South Carolina"
    }));
  }
};
