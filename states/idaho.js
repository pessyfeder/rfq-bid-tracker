// Idaho: Division of Purchasing "Open & Future Solicitations". The page's table is filled from a public
// WordPress JSON endpoint. Entries are a procurement pipeline: many carry only an *anticipated* close date.
const { http, clean } = require("./common");

const PAGE = "https://purchasing.idaho.gov/open-and-future-solicitations/";

const mdy = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

module.exports = {
  code: "ID", name: "Idaho",
  // Every row links to the same index page and the solicitation documents live in IPRO, so a page read only summarises the index (wrong scope, junk "shall" text).
  noPageReads: true,
  noPageReadsWhy: "Idaho rows link to one index page; the documents are in IPRO",
  noPageReadsNote: "Eligibility not read: Idaho lists solicitations on one index page and keeps the documents in IPRO. See the solicitation there.",
  async fetch() {
    const j = await (await http("https://purchasing.idaho.gov/wp-json/wm4/v1/procurement-report", { timeoutMs: 60000 }, 3)).json();
    if (!j || !Array.isArray(j.data)) throw new Error("Unexpected response from purchasing.idaho.gov");
    const out = [];
    for (const r of j.data) {
      const text = String(r.project_description || "");
      const close = /Close Date:\s*([^\n]*)/i.exec(text);
      const due = mdy(close && close[1]);
      if (!r.name || !due || /^completed$/i.test(r.status || "")) continue;
      const anticipated = /Anticipated Close/i.test(text);
      const posted = mdy((/Post Date:\s*([^\n]*)/i.exec(text) || [])[1]);
      out.push({
        id: clean(r.name).replace(/\s+-.*$/, "").replace(/\s+/g, "-"), // "RFP 1433 - NASPO ..." -> "RFP-1433"
        title: clean(r.name),
        agency: clean(r.agency) ? "Idaho " + clean(r.agency) : "Idaho agency",
        category: "No data",
        posted: posted && !/Anticipated Post/i.test(text) ? posted : null,
        due, dueTime: null,
        url: PAGE,
        description: (anticipated ? "Close date is anticipated (not yet confirmed). " : "") + clean(text),
        region: "Idaho"
      });
    }
    return out;
  }
};
