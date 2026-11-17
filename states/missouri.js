// Missouri: MissouriBUYS, powered by MOVERS (Oracle Fusion). The public "Solicitation Abstracts" page needs no login;
// it reads the guest REST resource supplierNegotiationAbstracts, which is what this adapter calls (read-only, open bids only).
const { http, clean, instantToEastern } = require("./common");
const { classify } = require("./classify");

const HOST = "https://ewqg.fa.us8.oraclecloud.com";
const BU = "300000005255687"; // State of Missouri procurement business unit (the id in the public listing URL)
const PAGE = `${HOST}/fscmUI/redwood/negotiation-abstracts/view/abstractlisting?prcBuId=${BU}&ojSpLang=en`;
// If MO suddenly errors (HTTP 404/400), check the Oracle REST version in this path first: "11.13.18.05" is pinned and Oracle may
// retire it. Find the current one by opening the listing page in a browser and reading the page's own
// /fscmRestApi/rest/rv:<id>/en/<version>/supplierNegotiationAbstractListings/... request in the network tab.
const API =`${HOST}/fscmRestApi/resources/11.13.18.05/supplierNegotiationAbstracts`;
const PAGE_SIZE = 100;

module.exports = {
  code: "MO", name: "Missouri",
  // Rows link to the listing page (no stable per-solicitation URL), so a page read would only see the index.
  noPageReads: true,
  noPageReadsWhy: "Missouri rows link to the MOVERS listing page; the documents are inside MOVERS",
  noPageReadsNote: "Eligibility not read: Missouri keeps solicitation documents inside MOVERS. See the solicitation there.",
  async fetch() {
    const out = [];
    for (let offset = 0; offset < 2000; offset += PAGE_SIZE) {
      const q = encodeURIComponent("NegotiationStatusCode='ACTIVE'");
      const url = `${API}?finder=RowFinderByBU;ProcurementBUId=${BU}&q=${q}&orderBy=CloseDate:desc&limit=${PAGE_SIZE}&offset=${offset}&onlyData=true`;
      const j = await (await http(url, { headers: { Accept: "application/json" }, timeoutMs: 60000 }, 3)).json();
      if (!j || !Array.isArray(j.items)) throw new Error("Unexpected response from MissouriBUYS (MOVERS)");
      for (const r of j.items) {
        const close = Date.parse(r.CloseDate || "");
        if (!r.NegotiationTitle || !close) continue;
        const { due, dueTime } = instantToEastern(close);
        out.push({
          id: clean(r.Negotiation).replace(/,\d+$/, ""),
          title: clean(r.NegotiationTitle),
          agency: clean(r.ProcurementBUName).replace(/^\d+-/, "") || "Missouri agency",
          // NegotiationType is the bid type (RFP/IFB/...), not a subject, so guess the category from the title and synopsis
          category: classify(clean(r.NegotiationTitle), clean(r.Synopsis)),
          posted: r.PostingDate || null,
          due, dueTime,
          url: PAGE,
          description: clean(r.Synopsis),
          region: "Missouri"
        });
      }
      if (!j.hasMore) break;
    }
    return out;
  }
};
