// TxDOT (Texas Department of Transportation) highway and maintenance lettings, from the Texas open-data portal:
// data.texas.gov dataset qh8x-rm8r "Official and Unofficial Bid Items" (Socrata API, meant for programmatic use,
// refreshed daily). It has one row per bid item, so rows are grouped into one notice per project (CSJ).
// This is the automatic route to the TxDOT notices that ESBD (which forbids automated reads) also lists.
// ESBD local-let notices use the id "<CSJ>_<MMYY>". (The manual ESBD CSV import was removed: only automatic sources are kept.)
const { http, clean, toEastern } = require("./common");

const API = "https://data.texas.gov/resource/qh8x-rm8r.json";
const PAGE_URL = "https://www.txdot.gov/business/letting-bids/project-letting.html"; // TxDOT's public letting information

module.exports = {
  code: "TXDOT", name: "TxDOT",
  noPageReads: true, // no per-notice page: every row links to the same letting page, so there is nothing to read
  noPageReadsWhy: "TxDOT lettings have no per-notice page to read",
  noPageReadsNote: "Eligibility not read: TxDOT lettings are published as bid items. See the proposal on ESBD or the TxDOT letting page.",
  async fetch() {
    const today = new Date().toISOString().slice(0, 10);
    const where = encodeURIComponent(`bid_recieved_until_date_and >= '${today}'`);
    const rows = await (await http(`${API}?$limit=20000&$where=${where}`, { timeoutMs: 90000 })).json();
    if (!Array.isArray(rows)) throw new Error("Unexpected response from data.texas.gov");
    if (!rows.length) throw new Error("data.texas.gov returned no open TxDOT lettings");
    const byCsj = new Map();
    for (const r of rows) {
      const k = r.control_section_job_csj;
      if (!k) continue;
      if (!byCsj.has(k)) byCsj.set(k, []);
      byCsj.get(k).push(r);
    }
    const out = [];
    for (const [csj, items] of byCsj) {
      const r = items[0];
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(r.bid_recieved_until_date_and || "");
      if (!m) continue;
      const when = toEastern(+m[1], +m[2], +m[3], +m[4], +m[5], "America/Chicago"); // TxDOT times are Central
      const place = [r.highway, r.county ? r.county + " County" : ""].filter(Boolean).join(", ");
      const kind = clean(r.project_classification) || clean(r.project_type) || "TxDOT project";
      const est = Number(r.sealed_engineer_s_estimate);
      const specs = [...new Set(items.map((x) => clean(x.specification_description)).filter(Boolean))].slice(0, 4);
      const bits = [
        r.let_type, r.district_division ? r.district_division + " District" : "",
        r.bidder_prequalification_waiver === true ? "Prequalification waived" : r.bidder_prequalification_waiver === false ? "Prequalification required unless waived" : "",
        r.mandatory_pre_bidders === true ? "Mandatory pre-bid conference" : "",
        specs.length ? "Work includes: " + specs.join("; ") : ""
      ].filter(Boolean);
      const pub = /^\d{4}-\d{2}-\d{2}/.exec(r.proposal_published_date || "");
      out.push({
        id: csj,
        title: `${kind}: ${place}`.replace(/:\s*$/, ""),
        agency: "Texas Department of Transportation",
        category: [clean(r.project_type), clean(r.project_classification)].filter(Boolean).join(" - ") || "No data",
        posted: pub ? pub[0] : null,
        due: when.due, dueTime: when.dueTime,
        url: PAGE_URL,
        description: bits.join(". ") + ".",
        value: est > 0 ? est : null, valueLabel: "Engineer's estimate, from TxDOT's open data",
        region: "Texas"
      });
    }
    if (!out.length) throw new Error("No usable TxDOT lettings parsed");
    return out;
  }
};
