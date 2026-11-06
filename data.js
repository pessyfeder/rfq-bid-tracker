// No made-up values: real requests come only from the live feeds (live-nyc.js, live-sam.js).
// If a feed has nothing, the page shows "No data".
//
// Shape the app expects in window.RFQS / live feed rfqs:
// level:    "Federal" | "State" | "Local"
// value:    estimated dollar value (number) or null if not published
// rfqUrl:   link to the solicitation / RFQ document
// details:  { region, requirements: [short strings], restriction: string|null, amended: bool }
// scope:    plain-English summary of the work ("" if unknown -> page shows "No data")
// shall:    key "shall" statements: [{ text, ref }] ([] if unknown)
// requires: what an offeror must hold to bid, e.g. ["GSA Schedule"]. [] = open to all.
//           null = restriction not read -> page shows "No data".

// Company profile used for the eligibility check.
// holds: null = Discover Group's real lists/certifications/licences have not been provided yet,
// so the eligibility column shows "No data". Fill in the real list once Israel provides it,
// e.g. holds: ["Small business", "MWBE"].
window.COMPANY = {
  name: "Discover Group",
  holds: null
};

window.RFQS = [];
