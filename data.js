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
//           null = restriction not read -> page shows "Not checked".
//           Listed in the Eligibility column only; the app does not judge eligibility.

window.RFQS = [];
