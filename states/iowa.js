// Iowa: DAS "Bid Opportunities" (bidopportunities.iowa.gov). The page's own table is filled from a
// public JSON endpoint (DataTables), which returns every posted bid with a Status field.
const { http, clean, instantToEastern } = require("./common");

const BASE = "https://bidopportunities.iowa.gov";
const msDate = (s) => { const m = /\/Date\((-?\d+)\)\//.exec(s || ""); return m ? Number(m[1]) : null; };

module.exports = {
  code: "IA", name: "Iowa",
  async fetch() {
    const j = await (await http(`${BASE}/Home/DT_HostedBidsSearch?agencyId=&enteredSearchText=`, { timeoutMs: 60000 })).json();
    if (!j || !Array.isArray(j.aaData)) throw new Error("Unexpected response from bidopportunities.iowa.gov");
    const out = [];
    for (const r of j.aaData) {
      if (!r.ID || !r.IsActive || !/^open$/i.test(r.Status || "")) continue;
      const due = msDate(r.ExpirationDate);
      if (!due) continue;
      const when = instantToEastern(due);
      const posted = msDate(r.EffectiveDate);
      out.push({
        id: r.BidNumber || r.ID,
        title: clean(r.Solicitation) || clean(r.Description),
        agency: clean(r.AgencyName) ? "Iowa " + clean(r.AgencyName) : "Iowa agency",
        category: "No data",
        posted: posted ? instantToEastern(posted).due : null,
        due: when.due, dueTime: when.dueTime,
        url: `${BASE}/Home/BidInfo?bidId=${encodeURIComponent(r.ID)}`,
        description: clean(r.Description),
        region: "Iowa"
      });
    }
    return out;
  }
};
