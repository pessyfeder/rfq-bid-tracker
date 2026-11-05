// SAMPLE DATA ONLY - replace with real feed (SAM.gov, state/city portals) later.
// The app reads window.RFQS; keep this shape when wiring up real data.
//
// level:    "Federal" | "State" | "Local"
// value:    estimated dollar value (number) or null if not published
// rfqUrl:   link to the solicitation / RFQ document
// details:  { region, requirements: [short strings], restriction: string|null, amended: bool }
window.RFQS = [
  {
    id: "SAMPLE-001",
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
