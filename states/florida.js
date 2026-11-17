// Florida: MyFloridaMarketPlace Vendor Information Portal, "State of Florida Advertisements"
// (vendor.myfloridamarketplace.com). It replaced the old Vendor Bid System (VBS) on 2022-03-28, which is why the
// earlier survey parked FL. The site is an Angular app over a public JSON API that needs no login:
//   POST /mfmp/pub/search/bids          (list; body = the search form; needs "Accept: application/json")
//   GET  /mfmp/pub/search/bids/detail?id=<advertisementId>   (description, contact, commodity codes, documents)
// The portal serves no robots.txt (404) and the advertisement search is public by design. Checked 2026-11-10.
// An empty search returns nothing; a filter (here status OPEN) is required. Only competitive solicitations are kept:
// ITB, ITN, RFP, RFI and RSQ. Agency Decisions, Informational/Public Meeting Notices, Grants and Single Source are skipped.
const { http, clean, sleep, instantToEastern } = require("./common");
const unspsc = require("./unspsc");

const ORIGIN = "https://vendor.myfloridamarketplace.com";
const API = ORIGIN + "/mfmp/pub/search/bids";
const KEEP = /^(Invitation to Bid|Invitation to Negotiate|Request for Proposals|Request for Information|Request for Statement of Qualifications)$/i;
const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

const body = (page) => JSON.stringify({
  pageSize: 100, type: [], status: ["OPEN"], agency: [], adNumber: "", agencyAdvertisementNumber: "", title: "",
  publishedDate: "", openDate: "", endDate: "", commodityCodes: [], intendsToParticipate: "", assignee: "", page
});

async function json(url, opts) {
  const res = await http(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { throw new Error("Florida portal did not return JSON (layout changed?)"); }
}

module.exports = {
  code: "FL", name: "Florida",
  // The detail JSON is read below, so the generic page reader is not needed.
  noPageReads: true,
  noPageReadsWhy: "Florida's portal is a JavaScript app; its description is read from the portal's JSON instead",
  noPageReadsNote: "Eligibility not read: attached documents were not opened. See the advertisement on MyFloridaMarketPlace.",
  async fetch() {
    const rows = [];
    for (let page = 1; page <= 20; page++) {
      const batch = await json(API, { method: "POST", headers: JSON_HEADERS, body: body(page) });
      if (!Array.isArray(batch)) throw new Error("Unexpected Florida list response");
      rows.push(...batch);
      if (batch.length < 100) break;
      await sleep(500);
    }
    const open = rows.filter((r) => r.status === "OPEN" && KEEP.test(r.type) && r.closeDate && Date.parse(r.closeDate) > Date.now());
    if (!open.length) throw new Error("No open Florida solicitations parsed");

    const out = [];
    for (const r of open) {
      await sleep(300);
      let d = {};
      try { d = await json(`${API}/detail?id=${r.advertisementId}`, { headers: { Accept: "application/json" } }); } catch (e) { /* plain description below */ }
      const when = instantToEastern(Date.parse(r.closeDate));
      const posted = (r.publishDate || "").slice(0, 10);
      const desc = clean(d.description || "");
      const ids = (d.commodityCodes || []).map((c) => c.id).filter(Boolean);
      const codes = (d.commodityCodes || []).map((c) => c.value).filter(Boolean).slice(0, 6).join("; ");
      out.push({
        id: String(r.uniqueName || "AD-" + r.advertisementId).toLowerCase(),
        title: r.title,
        agency: r.agency || (r.organization && r.organization.name) || "State of Florida",
        category: unspsc.category(ids) || r.type,
        naics: unspsc.naics(ids),
        posted: /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : null,
        due: when.due, dueTime: when.dueTime,
        url: `${ORIGIN}/search/bids/detail/${r.advertisementId}`,
        description: ((r.agencyAdNumber ? r.agencyAdNumber + ". " : "") + (desc || "Open the advertisement on MyFloridaMarketPlace for details.") + (codes ? " Commodities: " + codes : "")).slice(0, 600),
        region: "Florida"
      });
    }
    return out;
  }
};
