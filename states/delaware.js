// Delaware: official open-data API (Socrata) "Open Bids", data.delaware.gov dataset 2hnj-zwix.
const { http, clean } = require("./common");
const unspsc = require("./unspsc");

const URL_ = "https://data.delaware.gov/resource/2hnj-zwix.json?$limit=5000&$order=deadlinedate";

module.exports = {
  code: "DE", name: "Delaware",
  async fetch() {
    const rows = await (await http(URL_)).json();
    if (!Array.isArray(rows)) throw new Error("Unexpected response from data.delaware.gov");
    return rows.map((r) => ({
      id: r.contractnumber,
      title: clean(r.contracttitle),
      agency: clean(r.agencycode) ? "Delaware " + clean(r.agencycode) : "Delaware agency",
      category: unspsc.category(r.unspsc) || "No data",
      naics: unspsc.naics(r.unspsc),
      posted: (r.opendate || "").slice(0, 10) || null,
      due: (r.deadlinedate || "").slice(0, 10),
      dueTime: null, // the dataset publishes dates only
      url: r.bidurl && r.bidurl.url,
      description: r.unspsc ? "UNSPSC: " + clean(r.unspsc).replace(/;/g, ", ") : "",
      region: "Delaware"
    }));
  }
};
