// TxDOT (Texas Department of Transportation) highway and maintenance lettings, from the Texas open-data portal:
// data.texas.gov dataset qh8x-rm8r "Official and Unofficial Bid Items" (Socrata API, meant for programmatic use,
// refreshed daily). It has one row per bid item, so rows are grouped into one notice per project (CSJ).
// This is the automatic route to the TxDOT notices that ESBD (which forbids automated reads) also lists.
// ESBD local-let notices use the id "<CSJ>_<MMYY>". (The manual ESBD CSV import was removed: only automatic sources are kept.)
const { http, clean, toEastern } = require("./common");

const API = "https://data.texas.gov/resource/qh8x-rm8r.json";
const INFO_API = "https://data.texas.gov/resource/drau-zphx.json"; // Project Information: limits, type of work, estimate, DBE goal
const QA_API = "https://data.texas.gov/resource/8ywq-yvw9.json";   // Pre-bid Q&A Packet: vendors' questions and TxDOT's answers
const PAGE_URL = "https://www.txdot.gov/business/letting-bids/project-letting.html"; // TxDOT's public letting information

// Best-effort extras: a failure here is logged and the notices are still published without them.
async function projectInfo(csjs) {
  const byCsj = new Map();
  try {
    for (let i = 0; i < csjs.length; i += 100) {
      const list = csjs.slice(i, i + 100).map((c) => "'" + String(c).replace(/'/g, "''") + "'").join(",");
      const where = encodeURIComponent(`control_section_job_csj in(${list})`);
      const rows = await (await http(`${INFO_API}?$limit=5000&$where=${where}`, { timeoutMs: 90000 })).json();
      if (!Array.isArray(rows)) throw new Error("unexpected response");
      for (const r of rows) if (r.control_section_job_csj && !byCsj.has(r.control_section_job_csj)) byCsj.set(r.control_section_job_csj, r);
    }
  } catch (e) { console.warn(`  TXDOT: project information not added (${e.message})`); }
  return byCsj;
}

async function preBidQa(today) {
  const byCcsj = new Map(); // controlling CSJ -> [{ title, answer }]
  try {
    const where = encodeURIComponent(`bid_received_until_date_and >= '${today}'`);
    const rows = await (await http(`${QA_API}?$limit=5000&$where=${where}`, { timeoutMs: 90000 })).json();
    if (!Array.isArray(rows)) throw new Error("unexpected response");
    for (const r of rows) {
      const k = r.controlling_project_id_ccsj;
      if (!k || !clean(r.question_text)) continue;
      if (!byCcsj.has(k)) byCcsj.set(k, []);
      byCcsj.get(k).push({ title: clean(r.question_title) || clean(r.question_text).slice(0, 60), answer: clean(r.question_response_text) });
    }
  } catch (e) { console.warn(`  TXDOT: pre-bid Q&A not added (${e.message})`); }
  return byCcsj;
}

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

module.exports = {
  code: "TXDOT", name: "TxDOT",
  noPageReads: true, // no per-notice page: every row links to the same letting page, so there is nothing to read
  noPageReadsWhy: "TxDOT lettings have no per-notice page to read",
  noPageReadsNote: "Eligibility not read: TxDOT lettings are published as bid items. See the proposal on ESBD or the TxDOT letting page.",
  async fetch() {
    const today = require("../et-today").etToday();
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
    const info = await projectInfo([...byCsj.keys()]);
    const qa = await preBidQa(today);
    const out = [];
    for (const [csj, items] of byCsj) {
      const r = items[0];
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(r.bid_recieved_until_date_and || "");
      if (!m) continue;
      const when = toEastern(+m[1], +m[2], +m[3], +m[4], +m[5], "America/Chicago"); // TxDOT times are Central
      const pi = info.get(csj) || {};
      const place = [r.highway || pi.highway, (r.county || pi.county) ? (r.county || pi.county) + " County" : ""].filter(Boolean).join(", ");
      const kind = clean(r.project_classification) || clean(r.project_type) || "TxDOT project";
      const est = Number(r.sealed_engineer_s_estimate);
      const lowBid = Number(pi.project_estimate_low_bid); // TxDOT's project estimate, used when no sealed estimate is published yet
      const specs = [...new Set(items.map((x) => clean(x.specification_description)).filter(Boolean))].slice(0, 4);
      const limits = clean(pi.project_limits_from) && clean(pi.project_limits_to) ? `Limits: ${clean(pi.project_limits_from)} to ${clean(pi.project_limits_to)}` : "";
      const days = Number(pi.maximum_number_of_working), guarantee = Number(r.proposal_guarantee_amount || pi.proposal_guarantee_amount);
      const dbe = Number(pi.dbe_goal_percent);
      const questions = qa.get(csj) || qa.get(r.controlling_project_id_ccsj) || [];
      const bits = [
        clean(pi.project_description) || clean(pi.short_description),
        r.let_type, r.district_division ? r.district_division + " District" : "",
        r.mandatory_pre_bidders === true ? "Mandatory pre-bid conference" : "",
        clean(pi.type_of_work) ? "Type of work: " + clean(pi.type_of_work) : "",
        limits,
        days > 0 ? `Up to ${days} working days` : "",
        guarantee > 0 ? `Proposal guarantee ${money(guarantee)}` : "",
        dbe > 0 ? `DBE goal ${dbe}%` : "",
        clean(pi.local_agency_name) ? "Local agency: " + clean(pi.local_agency_name).replace(/\|/g, ", ") : "",
        specs.length ? "Work includes: " + specs.join("; ") : "",
        questions.length ? `Pre-bid Q&A (${questions.length} answered): ` + questions.slice(0, 3).map((x) => x.title + (x.answer ? " - " + x.answer.slice(0, 140) : "")).join(" | ") : ""
      ].filter(Boolean);
      const pub = /^\d{4}-\d{2}-\d{2}/.exec(r.proposal_published_date || "");
      out.push({
        id: csj,
        title: `${clean(pi.project_name) || kind}: ${place}`.replace(/:\s*$/, ""),
        agency: "Texas Department of Transportation",
        category: [clean(r.project_type), clean(r.project_classification)].filter(Boolean).join(" - ") || "No data",
        posted: pub ? pub[0] : null,
        due: when.due, dueTime: when.dueTime,
        url: PAGE_URL,
        requires: r.bidder_prequalification_waiver === false ? ["Prequalification required (unless waived)"] : null,
        description: bits.map((b) => b.replace(/\.+$/, "")).join(". ") + ".",
        value: est > 0 ? est : lowBid > 0 ? lowBid : null,
        valueLabel: est > 0 ? "Engineer's estimate, from TxDOT's open data" : "TxDOT project estimate, from TxDOT's open data",
        region: "Texas"
      });
    }
    if (!out.length) throw new Error("No usable TxDOT lettings parsed");
    return out;
  }
};
