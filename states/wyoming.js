// Wyoming: Dept. of Administration & Information, Purchasing. ai.wyo.gov is a Google Sites page that only points to
// Public Purchase, where open bids live: publicpurchase.com/gems/wyominggsd,wy/buyer/public/publicInfo (public, no login).
// Public Purchase scrambles the listing: each row is written by JavaScript, every title/date/description is split into
// <span id=...> pieces padded with random decoy spans, and trailing action("id",...) calls hide the decoys in the browser.
// We rebuild what a browser shows by dropping the spans named in those action() calls and joining the rest. No login,
// one request. If the page stops matching this shape we fail loudly rather than publish scrambled text.
const { http, clean, toEastern } = require("./common");

const HOST = "https://www.publicpurchase.com";
const LIST = HOST + "/gems/wyominggsd,wy/buyer/public/publicInfo";

// Undo the JS string escaping used inside the page script.
const unesc = (s) => s.replace(/\\(["'\/])/g, "$1");

// "Dec 11, 2026 2:00:00 PM MST" -> Eastern { due, dueTime }
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function stamp(s) {
  const m = /([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})(?::\d{2})? ([AP]M)/i.exec(s || "");
  if (!m || !MON[m[1].toLowerCase()]) return null;
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(+m[3], MON[m[1].toLowerCase()], +m[2], h, +m[5], "America/Denver");
}

// Visible text of an HTML fragment made of <span id=...> pieces: drop hidden ids, strip the rest.
function visible(fragment, hidden) {
  return clean(unesc(fragment).replace(/<span id=["']?(\w+)["']?>([\s\S]*?)<\/span>/gi, (_, id, t) => hidden.has(id) ? "" : t));
}

module.exports = {
  code: "WY", name: "Wyoming",
  async fetch() {
    const res = await http(LIST);
    const html = await res.text();
    const script = [...html.matchAll(/<script type="text\/javascript">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("tooltip = ") && s.includes("action("));
    if (!script) throw new Error("Listing script not found (page layout changed)");

    const hidden = new Set();
    for (const call of script.matchAll(/\baction\(([^)]*)\)/g)) for (const id of call[1].matchAll(/"(\w+)"/g)) hidden.add(id[1]);
    if (hidden.size < 10) throw new Error("Hidden-span list not found (page layout changed)");

    const chunks = script.split(/(?=tooltip = '<a href)/).slice(1);
    const rows = [];
    for (const ch of chunks) {
      const a = /bidView\?bidId=(\d+)[\s\S]*?>((?:<span[\s\S]*?<\\?\/span>)+)<\\?\/a>/.exec(ch);
      const desc = /class=\\?"balloonstyle\\?">';\s*tooltip \+= '([\s\S]*?)';\s*tooltip \+= '<\\?\/div>/.exec(ch);
      const tds = [...ch.slice(ch.indexOf(".update(")).matchAll(/<td[^>]*>([\s\S]*?)<\\?\/td>/g)].map((m) => m[1]);
      if (!a || tds.length < 4) continue;
      const title = visible(a[2], hidden);
      const start = stamp(visible(tds[1], hidden)), end = stamp(visible(tds[2], hidden));
      if (!title || !end) continue;
      rows.push({ bidId: a[1], title, description: desc ? visible(desc[1], hidden) : "", posted: start && start.due, when: end, addenda: visible(tds[4] || "", hidden) });
    }
    const declared = (html.match(/<tr id="tr_\d+"/g) || []).length;
    if (declared && rows.length < declared) throw new Error(`Parsed ${rows.length} of ${declared} rows (page layout changed)`);
    if (rows.some((r) => /[a-z0-9]{3,}\s+\d{5,}|\d{6,}\s+\d{5,}/i.test(r.title))) throw new Error("Decoy text still present in titles");

    return rows.map((r) => {
      const num = /^(?:RFP|RFQ|IFB|ITB|RFB|Bid)\s*#?\s*([\w-]+)/i.exec(r.title);
      return {
        id: r.bidId,
        title: r.title,
        agency: "State of Wyoming (A&I Purchasing)",
        category: "No data",
        posted: r.posted || null,
        due: r.when.due, dueTime: r.when.dueTime,
        url: `${HOST}/gems/wyominggsd,wy/bid/bidView?bidId=${r.bidId}`,
        description: (r.description.slice(0, 600) + (r.description.length > 600 ? "…" : "")) || `Wyoming A&I solicitation${num ? " " + num[1] : ""}.`,
        region: "Wyoming"
      };
    });
  }
};
