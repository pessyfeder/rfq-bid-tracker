// Mississippi: DFA "Buying and Selling to Government in Mississippi" bid search. The page's table is
// filled by a public DataTables (server-side) POST; it needs the full legacy parameter set, else HTTP 500.
const { http, clean, toEastern } = require("./common");

const BASE = "https://www.ms.gov/dfa/contract_bid_search/Bid";
const COLS = ["Agency", "BidNumber", "ObjectID", "VerNumber", "BidStatus", "AdvertiseDate", "SubmissionDate", "OpeningDate", "BidID"];

function tableParams(length) {
  const p = new URLSearchParams({ sEcho: "1", iColumns: String(COLS.length), sColumns: "", iDisplayStart: "0", iDisplayLength: String(length),
    sSearch: "", bRegex: "false", iSortingCols: "1", iSortCol_0: "6", sSortDir_0: "asc" });
  COLS.forEach((c, i) => {
    p.set("mDataProp_" + i, c); p.set("sSearch_" + i, ""); p.set("bRegex_" + i, "false");
    p.set("bSearchable_" + i, "true"); p.set("bSortable_" + i, "true");
  });
  return p;
}

// "/Date(ms)/" is local midnight (Central); the time of day is a separate "HH:mm:ss" string, also Central.
function dueFrom(dateStr, timeStr) {
  const m = /\((-?\d+)\)/.exec(dateStr || "");
  if (!m) return null;
  const d = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date(Number(m[1]))).map((x) => [x.type, Number(x.value)]));
  const t = /^(\d{1,2}):(\d{2})/.exec(timeStr || "");
  return toEastern(d.year, d.month, d.day, t ? Number(t[1]) : 23, t ? Number(t[2]) : 59, "America/Chicago");
}

module.exports = {
  code: "MS", name: "Mississippi",
  async fetch() {
    const res = await http(`${BASE}/BidData?AppId=1&Status=Open`, { method: "POST", timeoutMs: 90000,
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }, body: tableParams(1000) }, 3);
    const j = await res.json();
    if (!j || !Array.isArray(j.aaData)) throw new Error("Unexpected response from ms.gov bid search");
    const out = [];
    for (const r of j.aaData) {
      if (!r.BidID || !r.BidNumber || !/^open$/i.test(r.BidStatus || "")) continue;
      const when = dueFrom(r.SubmissionDate, r.SubmissionTime) || dueFrom(r.OpeningDate, r.OpeningTime);
      if (!when) continue;
      const adv = dueFrom(r.AdvertiseDate, r.AdvertiseTime);
      const desc = clean(r.BidDescription);
      out.push({
        id: r.BidNumber,
        title: desc.length > 200 ? desc.slice(0, 197) + "..." : desc || "(untitled)",
        agency: clean(r.Agency) ? "Mississippi " + clean(r.Agency).replace(/^MS /i, "") : "Mississippi statewide",
        category: clean(r.ProcurementCategoryDescription) || "No data",
        posted: adv ? adv.due : null,
        due: when.due, dueTime: when.dueTime,
        url: `${BASE}/Details/${r.BidID}?AppId=1`,
        description: [clean(r.BidType), desc].filter(Boolean).join(". "),
        region: "Mississippi"
      });
    }
    return out;
  }
};
