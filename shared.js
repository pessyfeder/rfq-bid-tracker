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
  // ---- Plain-language bid titles: ONE pipeline for the list (home.js) and the detail page (explore.html) ----
  function nice(t) { // ALL-CAPS titles become readable
    t = String(t || "").replace(/[ -]+/g, " ").trim();
    if (t.length > 8 && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[.:-]s*)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return t;
  }
  // Keyless fallback for rows with no AI headline: agencies paste whole notices into the title field. Drop the
  // deadline / contact tail, turn "X invites vendors to submit bids for Y" into "Y", and cut long text at a word.
  function shortTitle(orig, scope) {
    var t = String(orig || "").replace(/\s+/g, " ").trim();
    // a title cut off with "..." is completed from the scope text when that starts with the same words
    if (/(\.\.\.|…)$/.test(t) && scope) {
      var sc = String(scope).replace(/^[A-Z]{2,6} - RFx\.\s*/, "").replace(/\s+/g, " ").trim();
      if (sc.length > t.length && sc.toLowerCase().indexOf(t.slice(0, 40).toLowerCase()) === 0) t = sc.replace(/\s+\S*$/, "");
    }
    t = t.replace(/[\s\-:;,.(]*\b(quote deadline|bid deadline|proposals? (are )?due|bids? (are )?due|deadline|due date|submit (your )?(quotes?|bids?|proposals?)? ?to|contact|questions? (should be )?(directed )?to|e-?mail)\b[\s\S]*$/i, "");
    t = t.replace(/\S+@\S+/g, "").replace(/\s+/g, " ").trim();
    var m = /\b(?:bids?|quotes?|proposals?|responses?)\s+(?:for|on)\s+(?:the\s+)?(?:purchase and installation of|purchase of|provision of|supply of|installation of)?\s*(.{12,})$/i.exec(t);
    if (m && /\b(invites?|requests?|seeks?|solicits?)\b/i.test(t.slice(0, m.index))) t = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    t = t.replace(/(\.\.\.|…)\s*$/, "").trim();
    if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + "…";
    return t || String(orig || "");
  }

  // Final tidy for every headline (AI-written or rule-built):
  //  - never shows the buyer's own jurisdiction (state, "New York City", "City of X"): the row already has a location tag
  //  - drops solicitation numbers, status labels ("Bid Extension:", "*REBID*") and the "Not clear from the listing:" hedge
  //  - a notice / contact line or a bare code is replaced by what the description says is wanted, when it says
  function scopeHeadline(scope) {
    var s = String(scope || "").replace(/<[^>]+>/g, " ").replace(/^[A-Z]{2,6} - RFx\.\s*/, "").replace(/\s+/g, " ").trim();
    var m = /\b(?:seeks?|seeking|requests?|invites?|solicits?|will receive|anticipates?)\s+(?:sealed\s+|competitive\s+)?(?:bids?|proposals?|quotes?|quotations?|qualifications|responses?|applications?|purchasing)\s+(?:for|to|from[^,]{0,60}\bto)\s+(?:the\s+)?(?:purchase of|provide|furnish(?:ing)?)?\s*(.{12,}?)(?:[.;]|$)/i.exec(s);
    if (!m) m = /\b(?:plans?|intends?|proposes?)\s+(?:a\s+|an\s+|to\s+)?(?:sole[- ]source\s+)?(?:purchase of|to purchase|to buy|procurement of)\s+(.{8,}?)(?:,|[.;]|$)/i.exec(s);
    if (!m) return "";
    var t = m[1].replace(/\s+(until|by|no later than)\b[\s\S]*$/i, "").replace(/[,\s]+(?:funded|financed|paid|sponsored)$/i, "").trim();
    if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "") + "…";
    return t.length >= 12 ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  }
  // Applies to every headline (AI or rule-built), any level of government: drop state names / postal codes, county
  // names, solicitation / facility / project codes and fiscal-year tags, and turn leftover ALL-CAPS words into words.
  var KEEP_CAPS = /^(SDVOSB|HUBZONE|MWBE|USAFA|USCG|NAVFAC|NASA|AMTRAK|FEMA|USDA|NOAA|HVAC|IDIQ|COVID|OSHA|USACE|UNICOR|DODEA|WOSB|NNSA)$/;
  function stripNoise(t) {
    var N = window.STATE_NAMES || {}, abbr = [], names = ["District of Columbia", "Washington,? D.?C.?"];
    Object.keys(N).forEach(function (k) { if (/^[A-Z]{2}$/.test(k) && k !== "US") { abbr.push(k); names.push(String(N[k]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); } });
    var nm = names.join("|"), ab = abbr.join("|");
    function rx(re, f) { return new RegExp(re.source.replace("@NM@", nm).replace("@AB@", ab), f); }
    t = t.replace(/\b\w+_(?:solicitation|notice|rfq|rfp|ifb)\w*?_/gi, "")                       // 36C25627R0012_solicitation_notice_
      .replace(rx(/\s*(?:,|\bin\b|\bfor\b|\s[-–])\s*(?:the\s+)?(?:State of\s+)?(?:@NM@)\b(?=\s*[,;.)(]|\s*$)/, "gi"), "")
      .replace(rx(/\s*,?\s*\(?\b(?:@AB@)\b\)?\.?\s*$/, ""), "")
      .replace(rx(/,\s*(?:@AB@)\b(?=\s*[,;)])/, "g"), "")
      .replace(/\b(?:(?:in|for|of|at)\s+)?(?:the\s+)?County of [A-Z][\w.'-]*(?: [A-Z][\w.'-]*)?/g, "")
      .replace(/\b(?:[A-Z][\w.'-]*|[a-z]{3,})(?: [A-Z][\w.'-]*)?\s+County\b(?!\s+(?:Route|Road|Rd|Highway|Hwy|Line|Fair))/g, function (m) { return /^(?:the|in|for|of|at|and|a|an|by|to|each|every|any)\b/i.test(m) ? m : ""; })
      .replace(/[,\s]+\d{2,}(?:-\d+){2,}\s*$/, "")                                                      // trailing part / stock number: ", 01-24-3106"
      .replace(/\bTrk\s*:?\s*/g, "Track ").replace(/\bFOR\b/g, "for")
      .replace(/\bFY\s?'?\d{2,4}\b/gi, "").replace(/\bFiscal Year\s*\(FY\)\s*\d{2,4}\b/gi, "")
      .replace(/\b(\d)(?:st|nd|rd|th)?\s*QTR\b\.?/gi, function (m, d) { return ({ 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" })[d] + " quarter"; })
      .replace(/\bQTR\b\.?/gi, "quarter")
      .split(/(\s+)/).map(function (w) {
        var core = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
        if (!core || /^\s+$/.test(w)) return w;
        if (/^\d{5,}$/.test(core) || (/\d/.test(core) && /[A-Za-z]/.test(core) && core.length >= 5 && !/[a-z]{3,}/.test(core) && !/^\d+(st|nd|rd|th)$/i.test(core) && !/^\d+(lbs?|in|ft|mm|cm|kv|hp|gal|oz|kg|psi|gpm|amp|volt)$/i.test(core))) return "";
        return w;
      }).join("")
      .replace(/\b(?:Project|Proj\.?|Contract|Solicitation|Bid|No\.?|Number|#)\s*[A-Z0-9][\w-]*\d[\w-]*(?:\s+\d{1,4}\b)*/g, "")
      .replace(rx(/\s*,?\s*\(?\b(?:@AB@)\b\)?\.?\s*$/, ""), "")
      .replace(/[A-Z]{2,}(?:-[A-Z]{2,})+/g, function (w) { return w.charAt(0) + w.slice(1).toLowerCase(); })
      .replace(/[A-Za-z]{5,}/g, function (w, off, str) {   // ALL-CAPS words become words; acronyms (in brackets, no vowels, listed) stay
        if (w !== w.toUpperCase() || KEEP_CAPS.test(w) || !/[AEIOU]/.test(w) || /\([^)]*$/.test(str.slice(0, off))) return w;
        return w.charAt(0) + w.slice(1).toLowerCase();
      })
      .replace(/\b(?:FOR|AND|THE|OF|TO|IN|ON|AT|BY|WITH|FROM)\b(?=\s+\S)/g, function (w, off, str) { return off > 0 ? w.toLowerCase() : w; })
      .replace(/,(?=[A-Za-z])/g, ", ");
    return t.replace(/\s{2,}/g, " ").replace(/\s+([,.;:)])/g, "$1").replace(/\b(?:project|no\.?|number|solicitation|contract|facility|bldg|building)\s*#?\s*$/i, "").replace(/\(\s*\)/g, "").trim();
  }
  // Requirements written into a notice title ("- Site Visit Required", "SDVOSB - ...", "Mandatory Prebid/Site Visit, 5% Security, ...",
  // "MBE, WBE and Sdvob Subcontractor Procurement for ...") are NOT part of what is being bought. ONE table drives both sides, so
  // they cannot drift apart: cleanTitle() cuts each phrase out of the headline and flagsHtml() turns the same match into a chip.
  // To cover a new phrase, add a rule here. chips(m) returns [label, cls, why] triples; labels reuse facts.js wording so they merge.
  var SA_TOK = "(?:small business|sdvosb|vosb|wosb|edwosb|hubzone|8\\(a\\))";
  var MW_TOK = "(?:M\\/)?(?:MBE|WBE|DBE|MWBE|SDVOB|SDVOSB)(?:\\s+(\\d+)%)?";
  var MW_LIST = MW_TOK + "(?:\\s*(?:,\\s*and|,|\\/|&|\\||and)\\s*" + MW_TOK + ")*";
  function saLabel(pct, tok) { return (pct ? pct + "% " : "") + (/small business|^sb$/i.test(tok) ? "Small business" : tok.toUpperCase()) + " set-aside"; }
  function mwChip(txt) {
    var toks = [], pct = false, re = /(?:M\/)?(MBE|WBE|DBE|MWBE|SDVOB|SDVOSB)(?:\s+(\d+)%)?/gi, m;
    while ((m = re.exec(txt))) { if (m[2]) pct = true; var t = m[0].toUpperCase().replace(/^M\//, "M/"); if (toks.indexOf(t) < 0) toks.push(t); }
    return toks.length ? [[toks.join(" / ") + (pct ? " goals" : " subcontracting"), "elig", "Who can bid"]] : [];
  }
  var TITLE_RULES = [
    // "SDVOSB - Roof repair", "Total Small Business Set-Aside: Paving"
    { re: /^(?:(?:total\s+|partial\s+)?(?:SDVOSB|VOSB|WOSB|EDWOSB|HUBZone|8\(a\)|small business|SB)(?:\s+set[- ]aside)?)(?:\s*[-–:|]\s*|\s+)(?=[A-Za-z0-9(])/i,
      chips: function (m) { var t = /(SDVOSB|VOSB|WOSB|EDWOSB|HUBZone|8\(a\)|small business|SB)/i.exec(m[0])[1]; return [[saLabel("", t), "elig", "Who can bid"]]; } },
    // "... - 100% Small Business Set-Aside", "(SDVOSB Set-Aside)" anywhere in the title
    { re: new RegExp("\\s*[-–,|(]*\\s*(?:(?:total|partial)\\s+)?(?:(\\d+)%\\s*)?(" + SA_TOK + ")\\s+set[- ]?aside\\)?", "i"),
      chips: function (m) { return [[saLabel(m[1], m[2]), "elig", "Who can bid"]]; } },
    // "... - SDVOSB" (just the tag after a separator)
    { re: new RegExp("\\s*[-–,|]\\s*(?:(?:total|partial)\\s+)?(?:(\\d+)%\\s*)?(" + SA_TOK + ")(?=\\s*[-–,|]|\\s*$)", "i"),
      chips: function (m) { return [[saLabel(m[1], m[2]), "elig", "Who can bid"]]; } },
    // "... - Site Visit Required"
    { re: /\s*[-–,|]\s*(?:(?:mandatory\s+)?(?:pre-?bid\s+)?site\s+(?:visit|walk-?through)s?(?:\s+(?:is\s+)?(?:required|mandatory))?)(?=\s*[-–,|]|\s*$)/i,
      chips: function () { return [["Mandatory site visit / pre-bid", "cost", "Stated in the notice title"]]; } },
    // "Site visit required" / "mandatory site walk" in the middle of a title
    { re: /\s*\b(?:site\s+(?:visit|walk-?through)s?\s+(?:is\s+)?(?:required|mandatory)|(?:required|mandatory)\s+site\s+(?:visit|walk))\b/i,
      chips: function () { return [["Mandatory site visit / pre-bid", "cost", "Stated in the notice title"]]; } },
    // Pre-bid logistics glued to the end: "... Mandatory Prebid/Site Visit, 5% Security, Performance/Payment Bond",
    // "... Mandatory Pre bid 11/16/2026, 10:00 am", "... There is a non-mandatory pre-bid meeting on 11/20/26". All of it is a tail.
    { re: /(?<=\S[^]{7,}?)[\s,;:.–-]*(?:there is an?\s+|an?\s+)?(?:(?:non-?\s?mandatory|mandatory)\s+pre-?\s?bid|pre-?\s?bid\s+(?:conference|meeting|\/\s*site))[^]*$/i,
      guard: function (t) { return !/^pre-?\s?bid/i.test(t); },   // a title that IS the pre-bid notice has no job left to name
      chips: function (m) {
        var x = m[0], o = [];
        o.push(/non-?\s?mandatory/i.test(x) ? ["Optional pre-bid meeting", "info", "Stated in the notice title"] : ["Mandatory site visit / pre-bid", "cost", "Stated in the notice title"]);
        if (/\d+\s*%\s*(?:bid\s+)?security|bid (?:bond|security)/i.test(x)) o.push(["Bid bond / bid guarantee", "hard", "Stated in the notice title"]);
        if (/performance\s*\/?\s*(?:and\s*)?payment\s+bond/i.test(x)) o.push(["Performance / payment bond", "cost", "Stated in the notice title"]);
        return o;
      } },
    // "Parks M/WBE-Only Site Work ..."
    { re: /\s*\b(?:M\/)?(?:MBE|WBE|DBE|MWBE)(?:\s*[\/,&]\s*(?:M\/)?(?:MBE|WBE|DBE))*[- ]only\b/i,
      chips: function (m) { return [[m[0].replace(/[- ]only$/i, "").trim().toUpperCase() + " only", "elig", "Who can bid"]]; } },
    // "(Small Business Concerns and Minority Business Concerns only)"
    { re: /\s*\((?=[^()]*\b(?:small business|minority business|women|veteran|sdvosb|mbe|wbe)\b)[^()]*?\bonly\)\s*$/i,
      chips: function (m) { return [[/small/i.test(m[0]) && /minority/i.test(m[0]) ? "Small / minority business only" : /small/i.test(m[0]) ? "Small business only" : "Restricted bidders", "elig", "Who can bid"]]; } },
    // NY subcontracting calls: "MBE, WBE and Sdvob Subcontractor Procurement for ...", "PCI: MP/PW: MBE 20% WBE 10% Sdvob 5%: GC - ..."
    { re: new RegExp("^(?:[A-Z]{2,5}:\\s*[A-Z\\/]{2,6}:\\s*)?(?:opportunity for\\s+)?(?:" + MW_LIST + "(?:\\s+(?=\\d))?\\s*)+(?:\\s*(?:contracting\\s+)?opportunit(?:y|ies))?(?:\\s*subcontractors?(?:\\s+and\\/or\\s+suppliers)?\\s+for the following bid\\s*:)?\\s*[-–:]?\\s*(?=\\S)", "i"),
      guard: function (t) { return /[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(t); },   // keep the prefix when nothing readable would be left
      chips: function (m) { return mwChip(m[0]); } }
  ];
  function applyTitleRule(rule, t) { // -> { t: title without the phrase, m: the match } (m null when the rule does not apply)
    var m = rule.re.exec(t);
    if (!m || !m[0]) return { t: t, m: null };
    var out = t.slice(0, m.index) + t.slice(m.index + m[0].length);
    if (rule.guard && !rule.guard(out)) return { t: t, m: null };
    return { t: out, m: m };
  }
  function titleChips(title) { // the chips a title's requirement phrases stand for
    var t = String(title || "").replace(/\s+/g, " ").trim(), o = [];
    TITLE_RULES.forEach(function (rule) { for (var i = 0; i < 4; i++) { var a = applyTitleRule(rule, t); if (!a.m) break; o = o.concat(rule.chips(a.m)); t = a.t; } });
    return o;
  }

  function cleanTitle(t, r, code) {
    var orig = t = String(t || "").replace(/\s+/g, " ").trim(), m;
    if (t.length > 8 && /[A-Z]/.test(t) && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(?:Of|For|And|The|To|In|On|At|By|With|From)\b(?=\s+\S)/g, function (w, off) { return off > 0 ? w.toLowerCase() : w; });
    t = t.replace(/^(?:invitation (?:for|to) bids?|invitation to quote|request for (?:quotes?|quotations?|proposals?|bids?)|notice of (?:intent to )?(?:bid|award))\s*[-–:]\s*(?=\S)/i, "");
    t = t.replace(/^not clear from the listing:\s*/i, "").replace(/^\*?\s*re-?bid\s*\*?[\s:–-]*/i, "")
      .replace(/^(?:\*[^*]{2,30}\*\s*[-:–]?\s*)+(?=\S)/, "")                                   // "*Fax Bid* ..." status labels
      .replace(/^(?:General\s+)?(?:RFP|RFQ|IFB|ITB|RFB|RFI)\s*#?\s*\d[\w-]*\s*[:–-]\s*(?=[A-Za-z])/i, "")   // "General RFP 5026: ..."
      .replace(/(?<=\S{4,}.{6,})\s+[-–]\s+[A-Z]{3,5}$/, "")                                       // trailing agency tag " - DOC"
      .replace(/(?<=[A-Za-z].{5,}),?\s+\d+(?:-\d+)+$/, "")                                        // trailing item code ", 01-20-0100"
      .replace(/^addendum\s+(?:no\.?\s*)?#?\d+\s*[-:–]?\s*(?=[A-Za-z]{3})/i, "")                 // "Addendum No 1Mainframe ..." (separator may be missing)
      .replace(/^(bid extension|correction|addendum( no\.? ?\d+)?|amendment|open-ended|cancell?ed|re-?issued?)\s*[-:–]\s*/i, "")
      .replace(/^(?:[^-–:|]{0,40}\|\s*)?(?:(?:m\/?wbe|sdvob|dbe|mbe|wbe)\b[\s|,\/&]*)+(?:and\s+)?(?:subcontractors?|suppliers?|[&\/]|and|\s)*(?:opportunit(?:y|ies)|solicitations?)\s*(?:for\s*)?[-–:]\s*(?=\S)/i, "")   // "MWBE | Sdvob Subcontractor & Supplier Opportunity - ..."
      .replace(/^(?:[A-Z\/&]+\s+)*(?:opportunity)\s*[-–]\s*/i, function (x) { return /m\/?wbe|sdvob|mwbe/i.test(x) ? "" : x; })
      .replace(/^(?:(?:attn:?|m\/?wbe|sdvob|opp|subcontractors|suppliers|&|\/|and)\s*)+(?:opportunit(?:y|ies)|solicitations?)?\s*(?:for\s*)?[-–:]\s*(?=\S)/i, function (x) { return /m\/?wbe|sdvob/i.test(x) ? "" : x; })
      // buyer named as a prefix: "NYS DEC - ...", "Albany Port District Commission - ..." (second pass also catches it after the label above)
      .replace(/^(?:(?:NYS|NYC)\s+[A-Z]{2,6}|[A-Z][\w.&']*(?: [A-Z][\w.&']*){0,5} (?:Commission|Authority|Department|Dept\.?|Agency|Bureau|Office|Port District|Thruway))\s+[-–]\s+(?=[A-Za-z]{3}.{8,})/, "");
    var dash = /^(.{3,45}?)\s*[-–:]\s+(?=\S)/.exec(t);
    // a label made only of codes and solicitation words ("IFB 26-083 -", "Smd_a&cm_ rfq's 523158 -"), never real words ("FY 27 Tree Removal -")
    if (dash && /[A-Za-z]/.test(dash[1]) && /[\d_#]/.test(dash[1]) && t.length - dash[0].length >= 8 &&
        dash[1].split(/\s+/).every(function (w) { return /[\d_#]/.test(w) || /^(bid|rfp|rfq|rfb|ifb|itb|rfi|project|no\.?|number|pin|fy|&)('?s)?$/i.test(w) || /^[A-Z&\/]{2,6}('S)?$/.test(w); })) t = t.slice(dash[0].length);
    t = t.replace(/^(RFP|RFQ|IFB|ITB|RFB|RFI|ITN)\s*[-–:]\s*(?=[A-Za-z])/i, "").replace(/\s*[-–]\s*addendum\s*\d*\s*$/i, "");
    t = t.replace(/^(?:RFP|RFQ|IFB|ITB|RFB|RFI|ITN|ARFQ|CRFQ|PB)\b[\s#:.-]*[A-Za-z0-9][\w\/.-]*\d[\w\/.-]*[\s:–-]+(?=[A-Za-z])/i, "");
    t = t.replace(/^(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,}\s*[-:–]?\s+(?=[A-Za-z])/, "");
    var words = (t.match(/\b[A-Za-z]{3,}\b/g) || []).length;
    var boiler = /^(notice\b|submit to\b|email\b|sealed (bids|proposals)\b|written sealed\b|notice of (proposed|intent|sole)|the .{3,70}?\b(will receive|requests|invites|anticipates|is (hereby )?seeking)\b)/i.test(t) ||
      /^[A-Z][^.]{3,90}?\b(is|are) (hereby )?(soliciting|seeking|requesting|inviting|accepting)\b/.test(t) || /\bnotice of (proposed|intent)\b/i.test(t);
    var rq = /^[A-Z][^.]{3,90}?\b(?:requests?|invites?|seeks?|solicits?)\s+(?:sealed\s+)?(?:bids?|quotes?|proposals?|quotations?)\s+(?:for|on)\s+(?:the\s+)?(?:purchase of\s+)?(.{12,})$/.exec(t);
    if (rq) {   // "KDMC requests quotes for 53 new computers ... KDM..." -> what is wanted
      boiler = false;
      t = rq[1].replace(/(\.\.\.|…)\s*$/, "").replace(/\.\s[\s\S]*$/, "").replace(/\s+(?:in|of) the \w+ (?:groups?|lots?|items?) (?:below|above|listed)\b[\s\S]*$/i, "");
      var sp = /^(.{20,}?)\s+to\s+/.exec(t); if (sp) t = sp[1];
      if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "") + "…";
      t = t.charAt(0).toUpperCase() + t.slice(1);
    }
    var codey = /\d/.test(t) && words < 2 && t.length < 40;
    t = t.replace(/^\d{4}\s*[-–]\s*\d{4}\s+(?=[A-Za-z])/, "");
    if ((boiler || codey) && r) { var sh = scopeHeadline(r.scope); if (sh) t = sh; else if (boiler) t = "Bid notice (no description given)"; }
    if (r && r.level !== "Federal" && code) {
      var N = window.STATE_NAMES || {}, S = N[code];
      var tail = "(?=\\s*[,;(:]|\\s*$)", lead = "\\s*(?:,|\\b(?:in|for|at|across|within|statewide in))\\s+(?:the\\s+)?";
      if (code === "NYC") {
        t = t.replace(new RegExp(lead + "(?:City of )?(?:New York City|NYC|Five Boroughs of New York City)(?:\\s+(?:city )?government)?" + tail, "gi"), "")
          .replace(new RegExp("\\s*,\\s*New York" + tail, "gi"), "")
          .replace(/\b(?:the\s+)?(?:City of New York|New York City|NYC)(?:'s)?\s+(?=\S)/gi, "");
      } else if (code === "NY") {
        t = t.replace(new RegExp(lead + "(?:State of )?New York(?: State)?" + tail, "gi"), "").replace(/\b(?:the\s+)?(?:State of )?New York State(?:'s)?\s+(?=\S)/gi, "");
      } else if (S && S !== "New York") {
        var q = S.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(lead + "(?:State of )?" + q + tail, "gi"), "").replace(new RegExp("\\s*\\(" + q + "\\)", "gi"), "")
          .replace(new RegExp("\\b(?:the\\s+)?State of " + q + "(?:'s)?\\s+", "gi"), "state ")
          .replace(new RegExp("\\b" + q + "'s\\s+", "gi"), "")
          .replace(new RegExp("\\b" + q + "\\s+(?=state (?:government|agenc|employee))", "gi"), "")
          .replace(new RegExp("(?<!\\bof )(?<!\\bState of )\\b" + q + "\\s+(?!State\\b)(?=[A-Za-z])", "gi"), "");
      }
      // a city or town named only as the buyer: ", City of Lowell" / "for City of Salem" / "the City of Medford's ordinances"
      t = t.replace(/\s*,\s*(?:City|Town) of [A-Z][\w.' -]*?$/, "").replace(/\s+for\s+(?:the\s+)?(?:City|Town) of [A-Z][\w.' -]*?$/, "")
        .replace(/\b(?:the\s+)?(?:City|Town) of [A-Z][\w.-]*(?: [A-Z][\w.-]*)?'s\s+/g, "the city's ");
      t = t.replace(/\b(for|at|by|with|from) (Department|Dept|Division|Office|Commission|Board|Bureau|Agency|Authority)\b/g, "$1 the $2");
    }
    // tails and labels that say nothing about what is wanted: place of performance, street addresses, option-year terms, set-aside prefixes (shown as tags already)
    t = t.replace(/\s*\|\s*(?:POP|Period of Performance|PoP)\b[\s\S]*$/i, "").replace(/\s*\|\s*$/, "")
      .replace(/\s*\(?\bPOP:?[^)|]*\)?\s*$/i, "")
      .replace(/\s*[-–,]\s*(?:base\s+(?:year\s+)?plus\s+\w+\s+option\s+years?|base\s+(?:year\s+)?(?:and|\+)\s+\w+\s+option\s+years?|\w+\s+option\s+years?)\s*$/i, "")
      .replace(/\s*\((?:brand|brand name|brand name or equal)\)/gi, "")
      .replace(/,\s*\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Z][\w.' -]*?(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|highway|hwy|way|parkway|pkwy)\b\.?[\s\S]*$/i, "")
      .replace(/,\s*[A-Z][\w.' -]{2,50}\s+(?:Health Care|Healthcare|VA|Veterans)\s+(?:System|Network|Medical Center|VISN)\s*$/i, "")
      .replace(/,\s*(?:VISN\s*\d+|[A-Z][\w.' -]{2,40}\s+(?:VA Medical Center|VAMC|Air Force Base|AFB|Naval Station|Army Depot))\s*$/i, "");
    t = t.replace(/(?<=\S{4,}.{8,}),\s*(?:[A-Z][\w.&']*\s+){1,4}(?:Port District|Commission|Authority)$/, "");   // buyer named at the tail
    // requirement phrases glued onto the title are cut out here and shown as chips (see TITLE_RULES)
    TITLE_RULES.forEach(function (rule) { for (var i = 0; i < 4; i++) { var a = applyTitleRule(rule, t); if (!a.m) break; t = a.t; } });
    t = stripNoise(t);
    t = t.replace(/\s*(?:\.{2,}|…)+\s*$/, "");   // headlines never end in a trailing "..." (the dangling "for the" is dropped below)
    t = t.replace(/\s+([,.;:])/g, "$1").replace(/(^|\s)[,;:]+\s*/g, "$1").replace(/\s{2,}/g, " ").replace(/^[-–|]\s*/, "").replace(/(?:\s+(?:for|in|at|of|the|and|to|by|with|-|–))+\s*$/i, "").replace(/[,;:\s-]+$/, "").trim();
    t = t.replace(/&(?=[A-Za-z])/g, "& ");
    if ((t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length) t += ")";   // title cut off mid-parenthesis
    if (t.length < 8) t = orig.replace(/^not clear from the listing:\s*/i, "");
    // an acronym that opens the title (STC, SCDOT, IT) stays in capitals when the source wrote it that way
    var fw = /^[A-Za-z]{2,6}\b/.exec(t), ow = /^[A-Z]{2,6}\b/.exec(orig);
    if (fw && ow && fw[0].toUpperCase() === ow[0] && !/^(THE|FOR|AND|NEW|OFF|ONE|TWO|OUR|ALL|ANY|USE|OIL|AIR|CAR|BUS|PAY|WEB|BID|RFQ|RFP|IFB|ITB|RFB|RFI|ITN|OF|TO|IN|ON|AT|BY|AS|AN|OR|IS|NO)$/.test(ow[0]) &&
        (ow[0].length <= 3 || !/[AEIOUY]/.test(ow[0]) || /(?:DOT|DOC|DOH|DHS)$/.test(ow[0]) || KEEP_CAPS.test(ow[0]))) t = ow[0] + t.slice(fw[0].length);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  window.titleChips = titleChips;
  window.cleanBidTitle = function (t, raw) { return cleanTitle(t, raw, raw && raw.level === "Federal" ? "US" : String((raw && raw.id) || "").split("-")[0].replace("TXDOT", "TX")); };
  // The headline shown for a record: AI headline, else the federal catalogue / keyless cleanup, then the shared cleanup.
  window.listTitle = function (r) {
    var code = r.level === "Federal" ? "US" : String(r.id).split("-")[0].replace("TXDOT", "TX");
    var title = nice(r.plainTitle || (r.level === "Federal" && window.fedItemTitle ? window.fedItemTitle(r.title, r.scope) : shortTitle(r.title, r.scope)));
    title = cleanTitle(title, r, code);
    var agency = nice(r.agency);
    // a vague title ("Various Rail") gets the buyer added so it says something: "Various Rail (Metro-North Railroad)"
    if (agency && /various/i.test(title) && title.split(/s+/).length <= 3) {
      var who = agency.replace(/^.{2,6}s+[-–]s+(?=S)/, "");
      if (who && title.toLowerCase().indexOf(who.toLowerCase()) < 0) title += " (" + who + ")";
    }
    return title;
  };
})();
