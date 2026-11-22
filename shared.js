// Shared title and category helpers used by the home screen (home.js): RFQCat (category label and group) and fedItemTitle (federal catalogue titles).
(function () {
  // ---- NAICS codes in words ("NAICS 541990" alone is ambiguous) ----
  var NAICS_SECTOR = { "11": "Agriculture, Forestry, Fishing and Hunting", "21": "Mining, Oil and Gas", "22": "Utilities", "23": "Construction",
    "31": "Manufacturing", "32": "Manufacturing", "33": "Manufacturing", "42": "Wholesale Trade", "44": "Retail Trade", "45": "Retail Trade",
    "48": "Transportation", "49": "Warehousing and Postal Services", "51": "Information", "52": "Finance and Insurance", "53": "Real Estate, Rental and Leasing",
    "54": "Professional, Scientific and Technical Services", "55": "Management of Companies", "56": "Administrative, Support and Waste Management Services",
    "61": "Educational Services", "62": "Health Care and Social Assistance", "71": "Arts, Entertainment and Recreation", "72": "Accommodation and Food Services",
    "81": "Other Services (Repair, Personal, Civic)", "92": "Public Administration" };
  var NAICS_TITLE = {
    "236220": "Commercial and Institutional Building Construction", "237110": "Water and Sewer Line Construction", "237310": "Highway, Street and Bridge Construction",
    "237990": "Other Heavy and Civil Engineering Construction", "238110": "Poured Concrete Foundation and Structure Contractors", "238210": "Electrical Contractors",
    "238220": "Plumbing, Heating and Air-Conditioning Contractors", "238910": "Site Preparation Contractors", "238990": "All Other Specialty Trade Contractors",
    "311999": "All Other Miscellaneous Food Manufacturing", "332999": "All Other Miscellaneous Fabricated Metal Product Manufacturing",
    "334210": "Telephone Apparatus Manufacturing", "334220": "Radio, TV and Wireless Equipment Manufacturing", "334290": "Other Communications Equipment Manufacturing",
    "334310": "Audio and Video Equipment Manufacturing", "334419": "Other Electronic Component Manufacturing", "334510": "Electromedical and Electrotherapeutic Apparatus Manufacturing",
    "334516": "Analytical Laboratory Instrument Manufacturing", "336111": "Automobile Manufacturing", "336112": "Light Truck and Utility Vehicle Manufacturing",
    "336120": "Heavy Duty Truck Manufacturing", "336211": "Motor Vehicle Body Manufacturing", "336212": "Truck Trailer Manufacturing", "336310": "Motor Vehicle Gasoline Engine and Engine Parts Manufacturing",
    "336411": "Aircraft Manufacturing", "336413": "Other Aircraft Parts and Auxiliary Equipment Manufacturing", "336414": "Guided Missile and Space Vehicle Manufacturing",
    "336611": "Ship Building and Repairing", "336612": "Boat Building", "336992": "Military Armored Vehicle, Tank and Tank Component Manufacturing", "339113": "Surgical Appliance and Supplies Manufacturing",
    "423450": "Medical, Dental and Hospital Equipment Wholesalers", "423490": "Other Professional Equipment and Supplies Wholesalers", "423610": "Electrical Apparatus and Equipment Wholesalers",
    "423690": "Other Electronic Parts and Equipment Wholesalers", "423710": "Hardware Wholesalers", "423840": "Industrial Supplies Wholesalers", "424120": "Stationery and Office Supplies Wholesalers",
    "484110": "General Freight Trucking, Local", "485999": "All Other Transit and Ground Passenger Transportation", "488190": "Other Support Activities for Air Transportation",
    "492110": "Couriers and Express Delivery Services", "493110": "General Warehousing and Storage", "511210": "Software Publishers", "517311": "Wired Telecommunications Carriers",
    "517312": "Wireless Telecommunications Carriers", "517810": "Other Telecommunications", "518210": "Data Processing, Hosting and Related Services",
    "519290": "Web Search Portals and Other Information Services", "531120": "Lessors of Nonresidential Buildings", "531190": "Lessors of Other Real Estate Property",
    "532490": "Other Commercial and Industrial Machinery Rental and Leasing", "541110": "Offices of Lawyers", "541211": "Offices of Certified Public Accountants",
    "541219": "Other Accounting Services", "541310": "Architectural Services", "541330": "Engineering Services", "541340": "Drafting Services", "541350": "Building Inspection Services",
    "541360": "Geophysical Surveying and Mapping Services", "541370": "Surveying and Mapping (except Geophysical) Services", "541380": "Testing Laboratories",
    "541410": "Interior Design Services", "541511": "Custom Computer Programming Services", "541512": "Computer Systems Design Services", "541513": "Computer Facilities Management Services",
    "541519": "Other Computer Related Services", "541611": "Administrative Management and General Management Consulting", "541612": "Human Resources Consulting Services",
    "541613": "Marketing Consulting Services", "541614": "Process, Physical Distribution and Logistics Consulting", "541618": "Other Management Consulting Services",
    "541620": "Environmental Consulting Services", "541690": "Other Scientific and Technical Consulting Services", "541715": "Research and Development in Physical, Engineering and Life Sciences",
    "541720": "Research and Development in Social Sciences and Humanities", "541810": "Advertising Agencies", "541820": "Public Relations Agencies", "541830": "Media Buying Agencies",
    "541840": "Media Representatives", "541850": "Outdoor Advertising", "541860": "Direct Mail Advertising", "541870": "Advertising Material Distribution Services",
    "541890": "Other Services Related to Advertising", "541910": "Marketing Research and Public Opinion Polling", "541921": "Photography Studios, Portrait",
    "541922": "Commercial Photography", "541930": "Translation and Interpretation Services", "541940": "Veterinary Services", "541990": "All Other Professional, Scientific and Technical Services",
    "561110": "Office Administrative Services", "561210": "Facilities Support Services", "561311": "Employment Placement Agencies", "561320": "Temporary Help Services",
    "561410": "Document Preparation Services", "561421": "Telephone Answering Services", "561422": "Telemarketing Bureaus and Other Contact Centers", "561439": "Other Business Service Centers",
    "561499": "All Other Business Support Services", "561612": "Security Guards and Patrol Services", "561621": "Security Systems Services", "561720": "Janitorial Services",
    "561730": "Landscaping Services", "561790": "Other Services to Buildings and Dwellings", "561910": "Packaging and Labeling Services", "561990": "All Other Support Services",
    "562111": "Solid Waste Collection", "562910": "Remediation Services", "562998": "All Other Miscellaneous Waste Management Services", "611430": "Professional and Management Development Training",
    "611519": "Other Technical and Trade Schools", "611699": "All Other Miscellaneous Schools and Instruction", "611710": "Educational Support Services",
    "621111": "Offices of Physicians", "621399": "Offices of All Other Miscellaneous Health Practitioners", "621511": "Medical Laboratories", "621999": "All Other Miscellaneous Ambulatory Health Care Services",
    "623990": "Other Residential Care Facilities", "624190": "Other Individual and Family Services", "712110": "Museums", "721110": "Hotels and Motels",
    "722310": "Food Service Contractors", "811210": "Electronic Equipment Repair and Maintenance", "811219": "Other Electronic and Precision Equipment Repair and Maintenance",
    "811310": "Commercial and Industrial Machinery Repair and Maintenance", "811490": "Other Personal and Household Goods Repair and Maintenance", "812320": "Drycleaning and Laundry Services",
    "812910": "Pet Care Services", "813910": "Business Associations", "921190": "Other General Government Support", "928110": "National Security" };
  // "NAICS 541990" -> "NAICS 541990 - All Other Professional, Scientific and Technical Services" (sector name when the exact code isn't listed)
  // Some portals publish categories in capitals ("CONSTRUCTION"): sentence-case those so they merge with the same
  // category from other states, keeping known acronyms ("INFORMATION TECHNOLOGY (IT)" -> "Information technology (IT)").
  var CAT_ACRONYMS = { IT: 1, RFP: 1, RFQ: 1, RFI: 1, IFB: 1, SFS: 1, HVAC: 1, IDIQ: 1, NAICS: 1, UNSPSC: 1 };
  function tidyCat(c) {
    if (!/[A-Z]/.test(c) || /[a-z]/.test(c)) return c;
    var s = c.toLowerCase().replace(/[a-z]+/g, function (w) { return CAT_ACRONYMS[w.toUpperCase()] ? w.toUpperCase() : w; });
    return s.replace(/[a-zA-Z]/, function (ch) { return ch.toUpperCase(); }).replace(/\bnon-IT\b/i, "non-IT");
  }
  function catLabel(r) {
    var c = r.category || "", m = /^NAICS (\d{6})$/.exec(c);
    if (!m) return tidyCat(c);
    // The code stated in the solicitation itself beats the one typed into the SAM.gov listing (which is often wrong or not a real code).
    if (/^\d{6}$/.test(r.naics || "")) { m = [null, r.naics]; c = "NAICS " + r.naics; }
    var t = NAICS_TITLE[m[1]] || NAICS_SECTOR[m[1].slice(0, 2)];
    if (!t) return c;
    if (!TITLE_CODE[t]) TITLE_CODE[t] = m[1]; // remember the code so catGroup can still group by it
    return t; // title only - the code isn't shown
  }
  var TITLE_CODE = {};

  // Broad group for a category label, so the Category dropdown can show ~15 groups that expand into the exact categories.
  var NAICS_GROUP = { "11": "Agriculture", "21": "Utilities & energy", "22": "Utilities & energy", "23": "Construction", "31": "Goods & equipment",
    "32": "Goods & equipment", "33": "Goods & equipment", "42": "Goods & equipment", "44": "Goods & equipment", "45": "Goods & equipment",
    "48": "Transportation & vehicles", "49": "Transportation & vehicles", "51": "IT & telecom", "52": "Business & administrative",
    "53": "Business & administrative", "54": "Engineering & professional", "55": "Business & administrative", "56": "Maintenance & facilities",
    "61": "Education & recreation", "62": "Health & human services", "71": "Education & recreation", "72": "Goods & equipment",
    "81": "Maintenance & facilities", "92": "Government & safety" };
  // Manufacturing / wholesale / hospitality codes split further (by 3-digit NAICS) so "Goods" isn't one 140-item list.
  // All start with "Goods - " so the sub-groups sit together in the dropdown.
  var NAICS3_GROUP = { "311": "Goods - Food & beverage", "312": "Goods - Food & beverage", "313": "Goods - Apparel & textiles", "314": "Goods - Apparel & textiles",
    "315": "Goods - Apparel & textiles", "316": "Goods - Apparel & textiles", "321": "Goods - Wood, paper & chemicals", "322": "Goods - Wood, paper & chemicals",
    "324": "Goods - Wood, paper & chemicals", "325": "Goods - Wood, paper & chemicals", "326": "Goods - Plastics & materials", "327": "Goods - Plastics & materials",
    "331": "Goods - Metals & machinery", "332": "Goods - Metals & machinery", "333": "Goods - Metals & machinery", "334": "Goods - Electronics & electrical",
    "335": "Goods - Electronics & electrical", "336": "Transportation & vehicles", "337": "Goods - Furniture & misc", "339": "Goods - Furniture & misc",
    "423": "Goods - Wholesale & supplies", "424": "Goods - Wholesale & supplies", "721": "Goods - Food & beverage", "722": "Goods - Food & beverage" };
  var GROUP_RULES = [
    ["Goods - Furniture & misc", /chair|furniture|leased space|minivan|vans?/],
    ["General / procurement type", /^(rfp|rfq|rfi|rfx|ifb|invitation|request for|single feasible|hybrid|grant|committee|no data|miscellaneous|misc\b|goods( and| &|&|$)|services$|commodities|service - misc|equipment$|municipality|quasi|reques)/],
    ["Construction", /construct|highway|bridge|roadway|structures|sidewalk|seal coat|overlay|building and/],
    ["Agriculture", /agricultur|farming|forestry|wildlife|live plant|landscap|feed, bedding/],
    ["Environmental", /environment|air quality/],
    ["IT & telecom", /^(?!.*non-it).*(information technology|\bit\b|info technology|telecom|software|internet|database|broadcast)/],
    ["Maintenance & facilities", /maintenance|facilit|janitor|industrial cleaning|pest|repair/],
    ["Health & human services", /health|medical|human services|case management|drug|pharma|podiatr|client services|nursing/],
    ["Education & recreation", /educat|training|recreation|sports|music|toys|editorial|graphic/],
    ["Utilities & energy", /utilit|power gen|energy|fuel|lubricant/],
    ["Transportation & vehicles", /transport|freight|moving|warehous|vehicle|aviation/],
    ["Government & safety", /politic|civic|defense|public order|security|safety|judicial|law enforcement/],
    ["Engineering & professional", /engineer|architect|survey|professional|prof\b|research|legal|investigat/],
    ["Business & administrative", /management|mngmnt|business|administrative|personnel|personal|advertis|marketing|photograph|printing|financ|insurance|real property|land,|travel/],
    ["Goods - Food & beverage", /^(food|published products)|beverage|commissary/],
    ["Goods - Apparel & textiles", /apparel|textile/],
    ["Goods - Wood, paper & chemicals", /chemical|paper|mineral/],
    ["Goods - Electronics & electrical", /electrical|electronic|laboratory|illuminator/],
    ["Goods - Metals & machinery", /machinery|mach\.|manufactur|components|cleaning equipment|distribution and conditioning/],
    ["Goods - Wholesale & supplies", /equipment|supplies|products|materials|distribution|bldg equip/]
  ];
  function catGroup(label) {
    var code = TITLE_CODE[label] || (/^NAICS (\d{2})/.test(label) ? label.slice(6) : "");
    if (code) return NAICS3_GROUP[code.slice(0, 3)] || NAICS_GROUP[code.slice(0, 2)] || "Other";
    var s = label.split(";")[0].toLowerCase().trim();
    for (var i = 0; i < GROUP_RULES.length; i++) if (GROUP_RULES[i][1].test(s)) return GROUP_RULES[i][0];
    return "Other";
  }
  window.RFQCat = { label: catLabel, group: catGroup }; // used by the home screen's Category dropdown
  // Federal item / service listings arrive in catalogue shorthand. Examples handled here:
  //   "41--COOLER,AIR,EVAPORATIVE"  -> "Evaporative air cooler (Refrigeration, air conditioning and air circulating equipment)"
  //   "Z2DA--FY27 Multiple Award Task Order Contract, seed project no: 550-25-108, Renovate Bathrooms in B103"
  //                                 -> "Renovate Bathrooms in B103"
  // The 2-digit prefix is a Federal Supply Group; letter-led prefixes (Z2DA, J066, N044) are service codes and are dropped.
  var FSG = { 10: "Weapons", 12: "Fire control equipment", 13: "Ammunition and explosives", 14: "Guided missiles", 15: "Aircraft and airframe parts", 16: "Aircraft components", 17: "Aircraft ground handling equipment", 19: "Ships and small craft", 20: "Ship and marine equipment", 22: "Railway equipment", 23: "Motor vehicles and trailers", 24: "Tractors", 25: "Vehicle components", 26: "Tires and tubes", 28: "Engines and turbines", 29: "Engine accessories", 30: "Mechanical power transmission equipment", 31: "Bearings", 32: "Woodworking machinery", 34: "Metalworking machinery", 35: "Service and trade equipment", 36: "Special industry machinery", 37: "Agricultural machinery", 38: "Construction and excavating equipment", 39: "Materials handling equipment", 40: "Rope, cable and chain", 41: "Refrigeration, air conditioning and air circulating equipment", 42: "Fire fighting, rescue and safety equipment", 43: "Pumps and compressors", 44: "Furnace, steam plant and drying equipment", 45: "Plumbing, heating and waste disposal equipment", 46: "Water purification and sewage treatment equipment", 47: "Pipe, tubing, hose and fittings", 48: "Valves", 49: "Maintenance and repair shop equipment", 51: "Hand tools", 52: "Measuring tools", 53: "Hardware and abrasives", 54: "Prefabricated structures and scaffolding", 55: "Lumber and plywood", 56: "Construction and building materials", 58: "Communication and detection equipment", 59: "Electrical and electronic components", 60: "Fiber optics", 61: "Electric wire and power distribution equipment", 62: "Lighting fixtures and lamps", 63: "Alarm and security systems", 65: "Medical, dental and veterinary supplies", 66: "Instruments and laboratory equipment", 67: "Photographic equipment", 68: "Chemicals", 69: "Training aids and devices", 70: "IT equipment and software", 71: "Furniture", 72: "Household and commercial furnishings", 73: "Food preparation and serving equipment", 74: "Office machines", 75: "Office supplies", 76: "Books and publications", 77: "Musical instruments and radios", 78: "Recreational and athletic equipment", 79: "Cleaning equipment and supplies", 80: "Paints, sealers and adhesives", 81: "Containers and packaging", 83: "Textiles, tents and flags", 84: "Clothing and individual equipment", 85: "Toiletries", 87: "Agricultural supplies", 88: "Live animals", 89: "Food and subsistence", 91: "Fuels and lubricants", 93: "Nonmetallic fabricated materials", 94: "Nonmetallic raw materials", 95: "Metal bars and sheets", 96: "Ores and minerals", 99: "Miscellaneous" };
  var segVocab = null; // complete comma-segments seen in titles that were not cut off; tells a real last word from a chopped one
  function fedItemTitle(raw, scope) {
    var s = String(raw || "").trim().replace(/^\s+/, ""), group = "", m, catalog = false;
    if ((m = /^(\d{2})\d{0,2}--\s*(.+)$/.exec(s))) { group = FSG[+m[1]] || ""; s = m[2]; catalog = true; }
    else if ((m = /^[A-Z]\d{0,3}[A-Z0-9]{0,2}--\s*(.+)$/.exec(s))) s = m[1];
    else if (!/^[A-Z0-9 ,.\/&()'-]+$/.test(s) || s.indexOf(",") < 0) return stripBoilerplate(s, group);
    // Noun-first catalogue name ("VALVE,CHECK" or "Cable assembly,special"): short comma list -> "check valve"
    var parts = s.split(/\s*,\s*/).filter(Boolean);
    if (parts.length >= 1 && parts.length <= 4 && parts.every(function (p) { return p.length <= 26; }) && (catalog || /^[A-Z0-9 ,.\/&()'-]+$/.test(s)) && !/[a-z]{2}\.\s/.test(s)) {
      if (!segVocab) { segVocab = {}; (window.RFQS || []).forEach(function (r) { var t = String(r.title || ""); if (t.length < 22) t.replace(/^[^-]*--/, "").split(/\s*,\s*/).forEach(function (p) { segVocab[p.toUpperCase()] = 1; }); }); }
      // SAM chops these listings at about 26 characters, often mid-word ("DEHYDRATO", "ALTERNATING C"). Finish the last word from the
      // description when it appears there; otherwise drop the fragment rather than show half a word.
      if (String(raw).trim().length >= 22) {
        var lastSeg = parts[parts.length - 1], ws = lastSeg.split(/\s+/), f = ws[ws.length - 1], fl = f.toLowerCase();
        var prev = ws.length > 1 ? ws[ws.length - 2] : (parts.length > 1 ? parts[parts.length - 2].split(/\s+/).pop() : "");
        var sc = " " + decodeText(scope || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
        var whole = segVocab[f.toUpperCase()] || (fl.length > 2 && !/[iuvq]$/.test(fl) && (sc.indexOf(" " + fl + " ") >= 0 || sc.indexOf(" " + fl + "s ") >= 0));
        if (!whole) {
          var full = "", mm;
          if (prev && (mm = new RegExp(" " + prev.toLowerCase().replace(/[^a-z0-9]/g, "") + " (" + fl.replace(/[^a-z0-9]/g, "") + "[a-z]+)").exec(sc))) full = mm[1];
          if (!full && fl.length >= 3 && (mm = new RegExp(" (" + fl.replace(/[^a-z0-9]/g, "") + "[a-z]+) ").exec(sc))) full = mm[1].replace(/s$/, "");
          if (full) { ws[ws.length - 1] = full; parts[parts.length - 1] = ws.join(" "); }
          else if (!(fl.length >= 4 && /(IVE|AL|ED|ING|ER|OR|ION|IC|ARY|OUS|ENT|ANT|LE|Y|S)$/i.test(f))) { ws.pop(); if (ws.length) parts[parts.length - 1] = ws.join(" "); else parts.pop(); }
        }
      }
      if (!parts.length) return stripBoilerplate(s, group);
      var spec = [];
      parts = parts.filter(function (p) { var t = /^TY-?(\w+)$/.exec(p); if (t) { spec.push("type " + t[1]); return false; } return true; });
      if (!parts.length) return stripBoilerplate(s, group);
      var noun = parts.shift().toLowerCase(), mods = parts.reverse().map(function (p) { return p.toLowerCase(); });
      s = mods.concat(noun).join(" ");
      s = s.charAt(0).toUpperCase() + s.slice(1) + (spec.length ? ", " + spec.join(", ") : "");
      return s + (group && group.toLowerCase().indexOf(noun.replace(/s$/, "")) < 0 ? " (" + group + ")" : "");
    }
    return stripBoilerplate(s, group);
  }
  // Drops contract-vehicle filler and bare IDs from a comma-separated title, keeping the part that says what work is wanted.
  window.fedItemTitle = fedItemTitle;
  function stripBoilerplate(s, group) {
    var segs = s.split(/\s*,\s+/);
    if (segs.length > 1) {
      var keep = segs.filter(function (p) {
        return !/^(FY\s?\d{2,4}\s+)?((multiple|single)[- ]award\s+)?(task order\s+)?(contract|IDIQ|MATOC|SATOC|BPA)\b[\w\s-]*$/i.test(p) && !/\b(project|proj|contract|solicitation|seed)\s*(no|number|#)\b[.:]?\s*[\w-]*$/i.test(p) && !/^[\d-]{6,}$/.test(p);
      });
      if (keep.length && keep.length < segs.length) s = keep.join(", ");
    }
    s = s.replace(/^FY\s?\d{2,4}\s+(?=[A-Z])/, "");
    if (!/[a-z]/.test(s) && s.split(/\s+/).length <= 2) s = s.charAt(0) + s.slice(1).toLowerCase(); // "CIRCUIT BREAKER" -> "Circuit breaker"
    return group ? s + " (" + group + ")" : s;
  }
  function decodeText(s) { try { return new DOMParser().parseFromString(String(s), "text/html").documentElement.textContent; } catch (e) { return String(s); } }
})();
