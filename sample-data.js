// SAMPLE DATA for the public demo only (https://pessyfeder.github.io/rfq-bid-tracker/).
// Every request below is invented. It loads only on *.github.io; the real app uses the live feeds.
// Dates are relative to today so the demo never goes stale.
(function () {
  if (!/\.github\.io$/.test(location.hostname)) return;
  function iso(offset) { var t = new Date(); t.setDate(t.getDate() + offset); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); }
  function R(n, level, agency, title, category, posted, due, value, region, reqs, restr, scope, shall, requires, amended) {
    return { id: "SAMPLE-" + n, requires: requires, scope: scope, shall: shall.map(function (s) { return { text: s, ref: "Sec. " + n }; }),
      title: title, category: category, posted: iso(posted), due: iso(due), dueTime: "2:00 PM ET", level: level, agency: agency, value: value,
      rfqUrl: "https://example.com/sample-rfq/" + n,
      details: { region: region, requirements: reqs, restriction: restr, amended: !!amended, warnings: [] } };
  }
  (window.LIVE_SOURCES = window.LIVE_SOURCES || []).push({ meta: { source: "SAMPLE DATA (not real)", fetchedAt: new Date().toISOString(), count: 14 }, rfqs: [
    R(1, "Federal", "General Services Administration", "Janitorial Services, Federal Building, Brooklyn", "Services", -6, 21, 1850000, "New York, NY", ["Small business set-aside"], "Small business set-aside",
      "Daily janitorial and day-porter services for a 400,000 sq ft federal office building, base year plus four option years. Service Contract Act wage determination applies.",
      ["Contractor shall provide all labor, supplies and equipment.", "Workers shall pass a background check and fingerprinting before badging."], ["Small business"]),
    R(2, "Federal", "Department of Veterans Affairs", "HVAC Preventive Maintenance, Bronx Medical Center", "Maintenance", -10, 9, 920000, "Bronx, NY", ["SDVOSB set-aside"], "SDVOSB only",
      "Quarterly preventive maintenance and 24/7 emergency repair of chillers, boilers and air handlers.",
      ["Offeror shall hold a valid HVAC license.", "Emergency response shall be within 4 hours, 24/7."], ["SDVOSB"]),
    R(3, "Federal", "U.S. Army Corps of Engineers", "Seawall Repair, Staten Island Shoreline", "Construction", -14, 34, 6400000, "Staten Island, NY", ["Bid bond required"], null,
      "Repair of 1,200 linear feet of concrete seawall including demolition, formwork and re-pour. Davis-Bacon wages apply.",
      ["Bidder shall submit a bid bond of 20%.", "A mandatory pre-bid site visit shall be attended."], []),
    R(4, "Federal", "Social Security Administration", "IT Help Desk Support, Regional Office", "Information Technology", -3, 27, 740000, "New York, NY", ["Public trust clearance"], null,
      "Tier 1 and Tier 2 help desk support for 600 users, including onsite desktop support.",
      ["Staff shall hold a Public Trust clearance.", "Contractor shall provide past performance references for similar contracts."], ["Public Trust clearance"]),
    R(5, "State", "NYS Office of General Services", "Grounds Maintenance, Albany Campus", "Landscaping", -8, 16, 310000, "Albany, NY", ["MWBE goal 30%"], null,
      "Mowing, snow removal, tree care and seasonal planting across state office campuses. Three-year term with two renewals.",
      ["Contractor shall meet a 30% MWBE participation goal.", "Proof of general liability insurance shall be provided."], []),
    R(6, "State", "NYS Department of Transportation", "Highway Sign Fabrication and Installation", "Construction", -12, 40, 2250000, "Hudson Valley, NY", ["Prevailing wage"], null,
      "Fabrication and installation of overhead and roadside signs on Route 9 corridor.",
      ["Prevailing wage rates shall be paid.", "Contractor shall furnish a performance bond."], []),
    R(7, "State", "SUNY Purchase", "Campus Security Guard Services", "Security", -5, 6, 1100000, "Westchester, NY", ["Guard licenses"], "NYS security guard licence",
      "Unarmed security guards, 24/7 coverage of campus entrances and residence halls.",
      ["Guards shall hold a valid NYS guard registration.", "Coverage shall be 24/7 including holidays."], ["NYS security guard licence"]),
    R(8, "State", "NYS Department of Health", "Medical Waste Hauling and Disposal", "Services", -20, 3, 275000, "Statewide", [], null,
      "Collection, transport and disposal of regulated medical waste from three state laboratories.",
      ["Hauler shall hold a Part 364 waste transporter permit."], ["Part 364 permit"], true),
    R(9, "Local", "Parks and Recreation", "Playground Equipment Replacement, Queens", "Construction", -4, 18, 480000, "Queens, NY", ["MWBE goal"], null,
      "Removal and replacement of play equipment and safety surfacing at 8 playgrounds.",
      ["Contractor shall meet the MWBE subcontracting goal.", "Safety surfacing shall comply with ASTM F1292."], []),
    R(10, "Local", "Department of Education", "School Bus Routing Software", "Information Technology", -9, 25, 650000, "New York City", [], null,
      "Cloud-based routing and tracking software for 1,500 school bus routes, with three years of support.",
      ["Vendor shall integrate with the student information system.", "Vendor shall provide 99.9% uptime."], []),
    R(11, "Local", "Department of Sanitation", "Snow Removal Salt Spreader Trucks, Rental", "Equipment", -2, 12, 1300000, "New York City", ["Insurance minimums"], null,
      "Seasonal rental of 40 salt spreader trucks with operators on call overnight.",
      ["Operators shall be on call overnight during storm events.", "Insurance of $5M general liability shall be carried."], []),
    R(12, "Local", "NYC Housing Authority", "Lead Paint Abatement, Brooklyn Developments", "Construction", -15, 30, 3900000, "Brooklyn, NY", ["EPA RRP certification", "MWBE"], "EPA RRP certified firms",
      "Lead paint inspection and abatement in occupied apartments across 6 developments.",
      ["Firm shall hold EPA Lead-Safe certification.", "Workers shall pass background checks."], ["EPA RRP certification"]),
    R(13, "Local", "Department of Health and Mental Hygiene", "Public Health Outreach Printing", "Printing", -1, 14, 90000, "New York City", ["Small business"], null,
      "Print and delivery of multilingual public health flyers and posters, rolling orders over one year.",
      ["Vendor shall deliver within 5 business days of each order."], []),
    R(14, "Local", "Department of Citywide Administrative Services", "Office Furniture Contract, Citywide", "Goods", -25, -3, 2100000, "New York City", [], null,
      "Citywide requirements contract for office furniture. (Sample of an already-closed request.)",
      ["Vendor shall provide a 10-year warranty."], [])
  ] });
})();
