// Periscope "bso" public bid search (PrimeFaces/JSF), used by several states. No login needed.
// Reads the open-bids list from /bso/view/search/external/advancedSearchBid.xhtml?openBids=true and
// pages through it 25 rows at a time (the server rejects larger page sizes).
const { http, sleep, clean, decodeEntities, toEastern } = require("./common");

const PAGE = 25;
const MAX_PAGES = 40; // safety stop: 1000 bids

function parseRows(html, cols) {
  const rows = [];
  for (const part of html.split(/<tr data-ri="/).slice(1)) {
    const tr = part.slice(0, part.indexOf("</tr>") >= 0 ? part.indexOf("</tr>") : undefined);
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < cols.length - 1) continue;
    const link = /bidDetail\.sd[a-z]\?docId=([^&"]+)/.exec(cells[0] || "");
    rows.push({ docId: link ? decodeEntities(link[1]) : clean(cells[0]), cells: cells.map(clean) });
  }
  return rows;
}

function makeAdapter({ code, name, host, tz, readPaceMs }) {
  return {
    code, name, readPaceMs, // readPaceMs: slow, one-at-a-time document reads for portals whose bot check trips at volume
    async fetch() {
      const url = `${host}/bso/view/search/external/advancedSearchBid.xhtml?openBids=true`;
      const res = await http(url, { timeoutMs: 60000 }, 3);
      const jar = new Map();
      const remember = (r) => { for (const c of r.headers.getSetCookie ? r.headers.getSetCookie() : []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
      remember(res);
      const html = await res.text();
      const view = /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/.exec(html);
      const total = Number((/\d+-\d+ of (\d+)/.exec(html) || [])[1]);
      if (!view || !Number.isFinite(total)) throw new Error("Page layout not recognised (portal may have changed)");
      const headers = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => clean(m[1])).filter(Boolean);
      const col = (re) => headers.findIndex((h) => re.test(h));
      const cols = { org: col(/^Organization/i), desc: col(/^Description/i), open: col(/Opening Date/i), status: col(/^Status/i) };
      if (Object.values(cols).some((i) => i < 0)) throw new Error("Expected table columns not found: " + headers.join(", "));
      cols.length = headers.length;

      let all = parseRows(html, headers);
      let skipped = 0;
      for (let first = PAGE; first < total && first < PAGE * MAX_PAGES; first += PAGE) {
        await sleep(700);
        const cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
        const body = new URLSearchParams({
          "javax.faces.partial.ajax": "true", "javax.faces.source": "bidSearchResultsForm:bidResultId",
          "javax.faces.partial.execute": "bidSearchResultsForm:bidResultId", "javax.faces.partial.render": "bidSearchResultsForm:bidResultId",
          "bidSearchResultsForm:bidResultId": "bidSearchResultsForm:bidResultId", "bidSearchResultsForm:bidResultId_pagination": "true",
          "bidSearchResultsForm:bidResultId_first": String(first), "bidSearchResultsForm:bidResultId_rows": String(PAGE),
          "bidSearchResultsForm:bidResultId_skipChildren": "true", "bidSearchResultsForm:bidResultId_encodeFeature": "true",
          "bidSearchResultsForm": "bidSearchResultsForm", "javax.faces.ViewState": view[1]
        });
        const post = async () => {
          const r = await http(url, { method: "POST", body, timeoutMs: 60000, headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Faces-Request": "partial/ajax", "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": jar.get("XSRF-TOKEN") || "", Cookie: cookie } }, 3);
          const xml = await r.text();
          return { xml, got: parseRows(xml, headers) };
        };
        let { xml, got } = await post();
        if (/BlockPage|blocked by your filter/i.test(xml)) {
          // A content filter may block individual pages. Skip a few and report the state as partial.
          if (++skipped > 3) throw new Error(`Blocked by a network content filter at row ${first} of ${total}; ask IT to allow ${new URL(url).host}`);
          console.error(`${code}: page at row ${first} blocked by a network content filter; skipped`);
          continue;
        }
        if (!got.length) { await sleep(4000); ({ xml, got } = await post()); } // slow portals sometimes return an empty page once
        if (!got.length) {
          if (process.env.BSO_DEBUG) console.error("EMPTY PAGE RESPONSE:", xml.slice(0, 600));
          if (/BlockPage|blocked by your filter/i.test(xml)) throw new Error(`Blocked by a network content filter at row ${first} of ${total}; ask IT to allow ${new URL(url).host}`);
          throw new Error(`Paging stopped at row ${first} of ${total}`);
        }
        all = all.concat(got);
      }

      const out = [];
      for (const { docId, cells } of all) {
        const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(cells[cols.open] || "");
        if (!docId || !m) continue;
        let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
        const status = cells[cols.status] || "";
        if (/award|cancel|clos|expire/i.test(status)) continue; // open bids only
        const when = toEastern(+m[3], +m[1], +m[2], h, +m[5], tz);
        const desc = cells[cols.desc] || "";
        out.push({
          id: docId,
          title: desc.length > 200 ? desc.slice(0, 197) + "..." : desc,
          agency: cells[cols.org] || name + " agency",
          category: "No data",
          posted: null,
          due: when.due, dueTime: when.dueTime,
          url: `${host}/bso/external/bidDetail.sda?docId=${encodeURIComponent(docId)}&external=true&parentUrl=close`,
          description: desc,
          region: name
        });
      }
      if (total > 0 && !out.length) throw new Error("No usable rows parsed from " + total + " results");
      out.partialPages = skipped; // runner reports the state as partial when pages were skipped
      return out;
    }
  };
}

module.exports = [
  makeAdapter({ code: "NV", name: "Nevada", host: "https://nevadaepro.com", tz: "America/Los_Angeles" }),
  makeAdapter({ code: "NJ", name: "New Jersey", host: "https://www.njstart.gov", tz: "America/New_York" }),
  makeAdapter({ code: "OR", name: "Oregon", host: "https://oregonbuys.gov", tz: "America/Los_Angeles", readPaceMs: 5000 }),
  makeAdapter({ code: "IL", name: "Illinois", host: "https://www.bidbuy.illinois.gov", tz: "America/Chicago", readPaceMs: 5000 }),
  makeAdapter({ code: "MA", name: "Massachusetts", host: "https://www.commbuys.com", tz: "America/New_York", readPaceMs: 5000 })
];
