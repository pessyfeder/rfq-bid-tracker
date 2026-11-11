// Hawaii: HANDS (Hawaii Awards & Notices Data System, hands.ehawaii.gov), the state's own aggregator of
// open solicitations from HANDS, HIePRO (State eProcurement), and HePS (UH / DOE e-bidding). The SPO page
// (spo.hawaii.gov/for-vendors/bidding-opportunities) just points here.
// The HANDS front end is an Angular app; the list is the JSON call it makes itself:
//   POST /hands/api/bidding-opportunities?size=100&page=0&sort=publish_date_dt,desc
// No login or token needed, and the host serves no robots.txt rules (the path returns the portal home page).
// omitPagination:true returns every open row in one call (~210), so this is a single request.
// Times are Hawaii wall-clock (HST, no daylight saving) and converted to Eastern.
const { http, clean, toEastern } = require("./common");

const API = "https://hands.ehawaii.gov/hands/api/bidding-opportunities?size=100&page=0&sort=publish_date_dt,desc";
const DETAIL = "https://hands.ehawaii.gov/hands/opportunities/opportunity-details/";
const LIST = "https://hands.ehawaii.gov/hands/opportunities";

const mdy = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

// "12/10/2026 04:30 PM" (Hawaii) -> Eastern { due, dueTime }
const stamp = (s) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s || "");
  if (!m) return null;
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(+m[3], +m[1], +m[2], h, +m[5], "Pacific/Honolulu");
};

module.exports = {
  code: "HI", name: "Hawaii",
  async fetch() {
    const body = {
      query: "", showClosed: false, showCancelled: false, omitPagination: true, categories: [],
      procurementCategory: "", department: "", islands: [], statuses: ["POSTED"],
      publishDate: "", offerDueDate: "", jurisdiction: ""
    };
    const res = await http(API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
    const rows = ((await res.json()).data || {}).searchResult;
    if (!rows || !Array.isArray(rows.content)) throw new Error("Response shape not recognised (data.searchResult.content missing)");
    if (rows.totalPages > 1) console.warn(`HI: ${rows.totalPages} pages returned despite omitPagination; only the first is read`);

    const out = [], seen = new Set();
    for (const r of rows.content) {
      if (r.closed || !r.solicitionNo) continue;
      const t = stamp(r.dueDate);
      if (!t) continue;
      // HePS rows have id null and solicitation numbers repeat across agencies, so key on number + department.
      let id = `${r.system}-${r.solicitionNo}`;
      if (seen.has(id)) id += "-" + clean(r.department).replace(/[^A-Za-z0-9]+/g, "").slice(0, 12);
      if (seen.has(id)) continue;
      seen.add(id);
      const url = (r.detailsUrl || (r.system === "HANDS" && r.id ? DETAIL + r.id : LIST)).replace(/^http:\/\//i, "https://");
      out.push({
        id,
        title: clean(r.title),
        agency: [clean(r.department), clean(r.division)].filter((x, i, a) => x && a.indexOf(x) === i).join(" / ") || "State of Hawaii",
        category: clean(r.category) || "No data",
        posted: mdy(r.publishDate),
        due: t.due, dueTime: t.dueTime,
        url,
        description: `Source system: ${r.system}${r.island ? ". Island: " + clean(r.island) : ""}`,
        region: "Hawaii"
      });
    }
    return out;
  }
};
