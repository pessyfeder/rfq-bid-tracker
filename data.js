// SAMPLE DATA ONLY - replace with real feed (SAM.gov, state/city portals) later.
// The app reads window.RFQS; keep this shape when wiring up real data.
//
// level:    "Federal" | "State" | "Local"
// value:    estimated dollar value (number) or null if not published
// rfqUrl:   link to the solicitation / RFQ document
// details:  { region, requirements: [short strings], restriction: string|null, amended: bool }
// scope:    one-line plain-English summary of the work
// shall:    key "shall" statements from the RFQ: [{ text, ref }] - text verbatim or near-verbatim,
//           ref = section/page in the RFQ so the reader can check the source.
//           (Sample "shall" text below is invented for layout purposes.)
window.RFQS = [
  {
    id: "SAMPLE-001",
    scope: "Daily cleaning of 14 floors, 5 days a week, 1-year base + 4 option years.",
    shall: [
      { text: "The Contractor shall provide cleaning services Monday through Friday between 6:00 PM and 2:00 AM.", ref: "C.3.1, p.12" },
      { text: "The Contractor shall ensure all personnel pass a Public Trust background investigation prior to site access.", ref: "H.4, p.27" },
      { text: "The Contractor shall pay wages no lower than the applicable Service Contract Act wage determination.", ref: "I.2, p.31" }
    ],
    title: "Janitorial Services - Federal Building, 26 Federal Plaza",
    category: "Janitorial / Facilities",
    posted: "2026-10-20",
    due: "2026-11-19",
    dueTime: "2:00 PM ET",
    level: "Federal",
    agency: "GSA",
    value: 1850000,
    rfqUrl: "https://sam.gov/",
    details: {
      region: "New York, NY",
      requirements: ["TSA/Public Trust background check", "Prevailing wage (SCA)", "Site visit 11/10"],
      restriction: null,
      amended: false
    }
  },
  {
    id: "SAMPLE-002",
    scope: "24/7 armed and unarmed guard posts at 6 regional offices across NY, NJ and CT.",
    shall: [
      { text: "The Contractor shall staff each post 24 hours per day, 7 days per week, with no unfilled shifts.", ref: "C.2, p.8" },
      { text: "All guards shall hold a valid TSA-issued credential and a state security guard license.", ref: "H.1, p.19" },
      { text: "The Contractor shall provide a replacement guard within 2 hours of any absence.", ref: "C.5.2, p.14" },
      { text: "Offerors shall hold an active GSA Schedule contract at the time of quotation.", ref: "L.1, p.3" }
    ],
    title: "Security Guard Services - Regional Offices",
    category: "Security",
    posted: "2026-10-28",
    due: "2026-12-02",
    dueTime: "3:00 PM ET",
    level: "Federal",
    agency: "DHS",
    value: 4200000,
    rfqUrl: "https://sam.gov/",
    details: {
      region: "NY, NJ, CT",
      requirements: ["TSA-cleared personnel", "Armed guards (NY license)", "24/7 coverage"],
      restriction: "GSA Schedule holders only",
      amended: true
    }
  },
  {
    id: "SAMPLE-003",
    scope: "Preventive and emergency HVAC maintenance for 11 school buildings, 1 year.",
    shall: [
      { text: "The Contractor shall perform quarterly preventive maintenance on all rooftop and boiler units.", ref: "3.1, p.5" },
      { text: "The Contractor shall respond to emergency calls within 4 hours, including weekends.", ref: "3.4, p.6" },
      { text: "All workers shall complete DOE fingerprint clearance before entering any school.", ref: "6.2, p.11" }
    ],
    title: "HVAC Maintenance - Public Schools Cluster K",
    category: "HVAC / Maintenance",
    posted: "2026-10-30",
    due: "2026-11-14",
    dueTime: "11:00 AM ET",
    level: "Local",
    agency: "NYC DOE",
    value: 320000,
    rfqUrl: "https://example.org/rfq/003.pdf",
    details: {
      region: "Brooklyn, NY",
      requirements: ["M/WBE participation goal 30%", "Fingerprint clearance (DOE)", "NYC license required"],
      restriction: null,
      amended: false
    }
  },
  {
    id: "SAMPLE-004",
    scope: "Plowing and salting of state roadways in Zone 3 for the winter season.",
    shall: [
      { text: "The Contractor shall begin plowing within 1 hour of 2 inches of accumulation.", ref: "4.1, p.7" },
      { text: "The Contractor shall furnish a minimum of 10 plow-equipped trucks and operators.", ref: "5.3, p.9" }
    ],
    title: "Roadway Snow Removal - Zone 3",
    category: "Grounds / Snow",
    posted: "2026-10-01",
    due: "2026-11-03",
    dueTime: "12:00 PM ET",
    level: "State",
    agency: "NYS DOT",
    value: 780000,
    rfqUrl: "https://example.org/rfq/004.pdf",
    details: {
      region: "Hudson Valley, NY",
      requirements: ["Own plow fleet (min. 10 trucks)", "Bid bond 5%"],
      restriction: null,
      amended: false
    }
  },
  {
    id: "SAMPLE-005",
    scope: "Supply and install office furniture for 4 courtrooms and chambers.",
    shall: [
      { text: "The Contractor shall deliver and install all items within 90 days of award.", ref: "2.2, p.4" },
      { text: "The Contractor shall remove and dispose of all packaging and existing furniture.", ref: "2.5, p.5" }
    ],
    title: "Office Furniture Supply - Courthouse Refresh",
    category: "Supplies / Furniture",
    posted: "2026-11-02",
    due: "2026-12-15",
    dueTime: "4:00 PM ET",
    level: "State",
    agency: "NYS OGS",
    value: null,
    rfqUrl: "https://example.org/rfq/005.pdf",
    details: {
      region: "Statewide (NY)",
      requirements: ["NYS Contract Reporter registration", "Delivery + install included"],
      restriction: "Small business set-aside",
      amended: false
    }
  },
  {
    id: "SAMPLE-006",
    scope: "Replace main electrical panel and rewire two floors of the community center.",
    shall: [
      { text: "All electrical work shall be performed by a New Jersey licensed master electrician.", ref: "1.4, p.3" },
      { text: "The Contractor shall attend the mandatory pre-bid meeting on 11/12; quotes from non-attendees shall be rejected.", ref: "1.2, p.2" },
      { text: "The Contractor shall furnish a performance bond equal to 100% of the contract price.", ref: "7.1, p.15" }
    ],
    title: "Electrical Upgrades - Community Center",
    category: "Construction / Electrical",
    posted: "2026-10-25",
    due: "2026-11-25",
    dueTime: "1:00 PM ET",
    level: "Local",
    agency: "City of Newark",
    value: 560000,
    rfqUrl: "https://example.org/rfq/006.pdf",
    details: {
      region: "Newark, NJ",
      requirements: ["NJ master electrician license", "Performance bond", "Pre-bid meeting 11/12 (mandatory)"],
      restriction: null,
      amended: false
    }
  }
];
