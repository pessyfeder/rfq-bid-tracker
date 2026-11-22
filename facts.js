// Bid-factor rules, shared by the page (script tag) and the server (require). The server precomputes each notice's
// factors from its full text so the page does not need the long "shall" lists up front.
(function (root) {
  var FACT_RULES = [
    // gate: true = decides who may bid; shown in the Eligibility column (a softer "possible" chip when only keyword-matched).
    // Everything else is a Bid factor in Details (cost / effort / attractiveness).
    { label: "TSA-checked workers",        sev: "hard", gate: true, re: /\bTSA\b|transportation security administration|\bTWIC\b/i },
    { label: "Security clearance",         sev: "hard", gate: true, re: /security clearance|secret clearance|top secret|\bpublic trust\b|\bNACI\b|\bCAC\b/i },
    { label: "Background checks / fingerprinting", sev: "hard", gate: true, re: /background (check|investigation|screening)|fingerprint|criminal history|\bE-?Verify\b|\bbadg(e|ing)\b/i },
    { label: "License / certification",    sev: "hard", gate: true, re: /\blicens(e|ed|ure)\b|certified by|certification required|\bOSHA[- ]?(10|30)\b|master (plumber|electrician)|\bEPA\b.*certif/i },
    { label: "Minimum experience required", sev: "hard", gate: true, re: /(minimum|at least)\s+(of\s+)?(\w+\s+)?\(?\d*\)?\s*years?[^.]{0,40}experience|must have[^.]{0,40}\byears\b/i },
    { label: "Bid bond / bid guarantee",   sev: "hard", gate: true, re: /\bbid (bond|guarantee|security|deposit)\b|\bproposal (guarantee|security|deposit)\b/i },
    { label: "Bonding capacity minimum",   sev: "hard", gate: true, re: /bonding (capacity|capability)[^.]{0,40}(minimum|at least|\$)|\$[\d,.]+\s*(million)?[^.]{0,30}bonding (capacity|capability)/i },
    { label: "Performance / payment bond", sev: "cost", re: /(performance|payment|surety)\s+(bond|security)|\bsurety\b|bonding/i },
    { label: "Insurance minimums",         sev: "cost", re: /\binsurance\b|general liability|workers.? comp/i },
    { label: "Prevailing / living wage",   sev: "cost", re: /prevailing wage|living wage|service contract (labor )?standards|\bSCA\b|davis[- ]bacon|wage determination|\bunions?\b(?!\s+(station|square|city|county|pacific|street|avenue))|collective bargaining/i },
    { label: "Mandatory site visit / pre-bid", sev: "cost", re: /(mandatory|required)[^.]{0,60}(pre-?bid|site (visit|walk)|walk-?through|conference)|pre-?bid[^.]{0,40}mandatory|(site (visit|walk)|walk-?through)[^.]{0,30}(required|mandatory)/i },
    { label: "24/7 or after-hours",        sev: "cost", re: /24\s*\/\s*7|24[- ]hour|after[- ]hours|overnight|night shift|on-?call|emergency response/i },
    // note: true = the chip shows as written (a condition of the job), not as "Must provide ...".
    { label: "Domestic-content rule (Buy America / TAA)", sev: "cost", re: /buy america|buy american|\bBABA\b|trade agreements act|\bTAA\b|domestic (content|preference|product)|made in (the )?(usa|u\.s\.)|country of origin/i },
    { label: "Retainage or slow payment terms", sev: "cost", note: true, re: /\bretainage\b|\bretention (of|\d)|\bnet[- ]?(45|60|90)\b|payment (within|in) (45|60|90)|paid (within|in) (45|60|90)/i },
    { label: "Liquidated damages for late work", sev: "cost", note: true, re: /liquidated damages/i },
    { label: "Delivery terms (FOB / inside delivery)", sev: "cost", note: true, re: /\bF\.?O\.?B\.?\b|inside delivery|white[- ]glove|lift-?gate|delivery appointment|delivery window|place of delivery|unload(ing)? and (stag|unpack)/i },
    { label: "Escorted or restricted site access", sev: "cost", note: true, re: /\bescort(ed|s)?\b|restricted (area|access)|secure (facility|area|site)|\bSIDA\b|airport security|access badge/i },
    { label: "Drug testing of workers", sev: "cost", re: /drug[- ](test|screen)|drug-free workplace/i },
    { label: "Certified payroll / compliance reporting", sev: "cost", re: /certified payroll|utilization report|payroll report|compliance report|\bLCPtracker\b|\bB2Gnow\b|\bCompliance Wire\b/i },
    { label: "Permits and fees on the contractor", sev: "cost", note: true, re: /(contractor|vendor|bidder)[^.]{0,40}\b(obtain|pay for|secure|responsible for)[^.]{0,30}\bpermits?\b|\bpermits?\b[^.]{0,40}(at|by) (the )?(contractor|vendor)/i },
    { label: "Hazardous materials handling", sev: "cost", note: true, re: /asbestos|lead[- ]based paint|hazardous (material|waste)|\bSWPPP\b|abatement/i },
    { label: "Fixed price, no escalation", sev: "cost", note: true, re: /no (price )?escalation|firm[- ]fixed[- ]price|prices? (shall |must |will )?(remain|be held) (fixed|firm)|price adjustments? (is|are) not (permitted|allowed)/i },
    { label: "Warranty requirement", sev: "info", note: true, re: /warrant(y|ies)\b[^.]{0,50}\b(year|month|extended|period)|\b(one|two|three|five|\d+)[- ]year warranty/i },
    { label: "Brand-name / \"or equal\" spec", sev: "info", note: true, re: /brand[- ]name|\bor (approved )?equal\b(?! (to|in|or))|salient characteristics/i },
    { label: "Owner can terminate for convenience", sev: "info", note: true, re: /terminat\w+ for (the )?(convenience|government.s convenience)/i },
    { label: "Submittals / samples for approval", sev: "info", note: true, re: /\bsubmittals?\b|samples? (for|must be) (approval|submitted)/i },
    { label: "Local / in-state preference", sev: "info", re: /\b(local|in-state|resident) (vendor|bidder|business|preference)\b/i },
    { label: "Past performance / references", sev: "info", re: /past performance|references|\bCPARS\b|years of experience|similar (projects|contracts)/i },
    { label: "Multi-year / renewal term",  sev: "info", re: /option (year|period)|base (year|period)|\b\d+[- ]year (contract|term)|renewal/i },
    // Requirement checklist rules (specs, submission, delivery, payment, compliance paperwork). They are shown under Requirements on the details page and as chips on the cards.
    { label: "Quantities stated",          sev: "info", note: true, re: /\b\d[\d,]*(?:\.\d+)?\s+(?:units?|each|ea\b|items?|pieces?|licen[sc]es?|seats?|users?|vehicles?|gallons?|tons?|pounds?|lbs?\.?|boxes|cases|sets?|pairs?|acres?|sq\.? ?ft\.?|square feet|linear feet|lots?|doors?|windows?|devices?|computers?|laptops?|buses|trucks?|rooms?|buildings?|sites?|locations?|kits?)\b|\bquantity (of|:)\s*\d|estimated (annual )?quantit/i },
    { label: "Quality / technical standards", sev: "info", note: true, re: /\bASTM\b|\bISO[- ]?\d|\bANSI\b|\bUL[- ]?\d*\s*(listed|certified|approved)|\bNSF\b|\bNFPA\b|\bASHRAE\b|\bIEEE\b|\bFDA[- ](approved|registered)|\bEnergy Star\b|\bMIL-(STD|SPEC)|meets? or exceeds?|conform(s|ing)? to (the )?(specifications?|standards?)/i },
    { label: "Submission format / method", sev: "info", note: true, re: /sealed (bids?|proposals?|quotes?)|submit(ted)? (your )?(bids?|proposals?|quotes?|offers?)?\s*(electronically|online|by email|via|through)|electronic(ally)? submi|hard copy|original and \d+ (copies|cop(y|ies))|\d+ (hard )?cop(y|ies) of (the |your )?(bid|proposal|quote)|\bnotariz|bids? must be (submitted|received|delivered)|(proposals?|bids?|quotes?) (shall|must) be (submitted|signed|sealed|marked)/i },
    { label: "Questions / amendment deadline", sev: "info", note: true, re: /(questions?|inquiries|requests? for clarification)[^.]{0,60}(due|must be (submitted|received)|no later than|deadline|by \d)|deadline for (questions|inquiries)/i },
    { label: "Delivery / completion timeline", sev: "cost", note: true, re: /deliver(y|ed|ies)?[^.]{0,60}within\s+\(?\w+\)?\s*\(?\d*\)?\s*(calendar |business |working )?(days?|weeks?|months?)|within\s+\(?\w+\)?\s*\(?\d*\)?\s*(calendar |business |working )?(days?|weeks?) (of|after|from) (the )?(award|receipt|notice|purchase order|contract|order)|(completion|delivery) (date|time)|completed? (by|within)\s+\w+|period of performance|notice to proceed|\blead[- ]time|\bdelivery schedule/i },
    { label: "Payment terms", sev: "info", note: true, re: /\bnet[- ]?(10|15|20|30)\b|payment (will be made |is due |shall be made )?(within|in) \w*\s*\(?\d+\)?\s*(calendar )?days|invoices?[^.]{0,40}(monthly|within \d+|upon (completion|delivery))|progress payments?|payment terms|prompt pay|paid (upon|after|monthly)|payment (schedule|will be)/i },
    { label: "Required forms / compliance documents", sev: "cost", note: true, re: /\bW-?9\b|affidavit|non-?collusion|certificate of insurance|debarment|conflict of interest (form|disclosure|statement)|representations and certifications|\bSF[- ]?\d{2,4}\b|\bMWBE\b[^.]{0,30}(plan|utilization|form)|utilization plan|equal employment|affirmative action|iran (divest|investment)|anti-?kickback|disclosure (form|statement)|signed (and notarized )?(form|certification)|\bsubmit\b[^.]{0,40}\bcertificates?\b|vendor (application|registration form)/i }
  ];
  // Which checklist group each rule belongs to (shown as one colour per group on the cards, and as sub-headings under Requirements).
  var GROUPS = [
    { id: "specs",    title: "Specs, quantities and quality", color: "#ccfbf1", ink: "#0f5c55" },
    { id: "deadline", title: "Deadlines and submission",      color: "#dbeafe", ink: "#1d4ed8" },
    { id: "delivery", title: "Delivery and schedule",         color: "#ffedd5", ink: "#9a3412" },
    { id: "payment",  title: "Payment and financial",         color: "#dcfce7", ink: "#166534" },
    { id: "certs",    title: "Certifications and compliance", color: "#f3e8ff", ink: "#6b21a8" },
    { id: "terms",    title: "Other terms",                   color: "#e2e8f0", ink: "#334155" }
  ];
  var GROUP_OF = {
    "Quantities stated": "specs", "Quality / technical standards": "specs", "Brand-name / \"or equal\" spec": "specs", "Submittals / samples for approval": "specs",
    "Warranty requirement": "specs", "Domestic-content rule (Buy America / TAA)": "specs", "Hazardous materials handling": "specs",
    "Submission format / method": "deadline", "Questions / amendment deadline": "deadline", "Mandatory site visit / pre-bid": "deadline",
    "Delivery / completion timeline": "delivery", "Delivery terms (FOB / inside delivery)": "delivery", "24/7 or after-hours": "delivery", "Escorted or restricted site access": "delivery",
    "Liquidated damages for late work": "delivery", "Multi-year / renewal term": "delivery",
    "Payment terms": "payment", "Retainage or slow payment terms": "payment", "Bid bond / bid guarantee": "payment", "Bonding capacity minimum": "payment", "Performance / payment bond": "payment",
    "Insurance minimums": "payment", "Prevailing / living wage": "payment", "Fixed price, no escalation": "payment", "Permits and fees on the contractor": "payment",
    "TSA-checked workers": "certs", "Security clearance": "certs", "Background checks / fingerprinting": "certs", "License / certification": "certs", "Minimum experience required": "certs",
    "Required forms / compliance documents": "certs", "Certified payroll / compliance reporting": "certs", "Drug testing of workers": "certs", "Past performance / references": "certs"
  };
  function groupOf(label) { return GROUP_OF[label] || "terms"; }
  var TERM_KEYS = ["specs", "deadline", "delivery", "payment", "certs"]; // the same ids as GROUPS; AI-read lines live in record.terms
  var KEYWORD_ONLY = /^(NY|WY|DE|TXDOT|ID|KS|PA)-/;
  // Short hover text: just the stretch of text around the match, not the whole paragraph.
  function excerpt(text, m) {
    var raw = String(text);
    // m.index is an offset into the raw text: collapse whitespace in the part before the match the same way, so the offset
    // still lands on the match (an indexOf of the match text could hit an earlier copy or miss and fall back to 0).
    var at = raw.slice(0, m.index).replace(/\s+/g, " ").replace(/^ /, "").length;
    text = raw.replace(/\s+/g, " ").trim();
    var max = 120;
    // The sentence holding the match: from the previous ". " to the next one.
    var start = text.lastIndexOf(". ", at);
    start = start < 0 ? 0 : start + 2;
    var end = text.indexOf(". ", at);
    end = end < 0 ? text.length : end + 1;
    var s = text.slice(start, end);
    if (s.length <= max) return s;
    // Still long: keep a window around the match, cut at word boundaries.
    var a = Math.max(0, at - start - 40), b = Math.min(s.length, a + max);
    if (a > 0) a = s.indexOf(" ", a) + 1 || a;
    if (b < s.length) { var sp = s.lastIndexOf(" ", b); if (sp > a) b = sp; }
    return (a > 0 ? "…" : "") + s.slice(a, b).trim() + (b < s.length ? "…" : "");
  }
  // First match of each rule across `src` (an array of strings) -> fact list.
  function scan(src, kw) {
    var out = [];
    FACT_RULES.forEach(function (rule) {
      for (var i = 0; i < src.length; i++) {
        var m = rule.re.exec(src[i]);
        if (m) { var f = { label: rule.label, sev: rule.sev, grp: groupOf(rule.label), why: excerpt(src[i], m) }; if (rule.gate) f.gate = true; if (rule.note) f.note = true; if (kw) f.kw = true; out.push(f); return; }
      }
    });
    return out;
  }
  // Facts from the full text of a notice and its readable attachments (HTML page text, Word files). Run at fetch time and
  // saved on the record as docFacts. PDFs are read by the model only, so they reach the record through shall/requires.
  function scanText(text) {
    text = String(text || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    return text.trim() ? scan([text], false) : [];
  }
  function keyFacts(r) {
    var x = r.details || {};
    var src = [];
    // States whose notices carry no readable documents (NY, WY, DE, TXDOT, ID, KS, PA) get a free keyword match on the title and scope line.
    var kw = !r.aiRead && KEYWORD_ONLY.test(String(r.id || ""));
    if (kw && r.title) src.push(r.title);
    if (r.scope) src.push(r.scope);
    (r.shall || []).forEach(function (s) { src.push(s.text); });
    (x.requirements || []).forEach(function (q) { src.push(q); });
    (r.terms ? TERM_KEYS : []).forEach(function (k) { (r.terms[k] || []).forEach(function (q) { src.push(q); }); }); // AI-read requirement lines
    if (x.restriction) src.push(x.restriction);
    var out = scan(src, kw);
    // Facts found in the attached documents' full text fill in what the short summary lines missed.
    (r.docFacts || []).forEach(function (f) {
      if (!out.some(function (o) { return o.label === f.label; })) out.push(f);
    });
    return out;
  }
  // Plain-language meaning of each chip, for the click popover. Keyed by FACT_RULES label.
  var EXPLAIN = {
    "TSA-checked workers": "Workers must pass a federal transportation security check (TSA/TWIC) before they can work on site, usually at airports, ports or similar sites. Getting these takes time and money.",
    "Security clearance": "Staff need a government security clearance or similar vetting. If your people do not already have one, you probably cannot bid.",
    "Background checks / fingerprinting": "Your workers must pass background checks or be fingerprinted before getting on site. Plan for the time and cost.",
    "License / certification": "You need a specific trade license or certification (for example electrician, plumber or OSHA training) to bid or do the work.",
    "Minimum experience required": "The buyer requires a minimum number of years of experience. Without it, your bid may be rejected.",
    "Bid bond / bid guarantee": "You must put up a guarantee with your bid (a bond or a deposit, often 5% of the bid). It protects the buyer if you win and then walk away.",
    "Bonding capacity minimum": "You need a surety company willing to back you for a set dollar amount of bonds. Small or new companies often cannot qualify.",
    "Performance / payment bond": "If you win, you must buy a bond from a surety that guarantees you will finish the job and pay your suppliers. It adds to your cost.",
    "Insurance minimums": "You must carry a minimum amount of insurance (such as liability or workers' compensation). Check that your policy is large enough.",
    "Prevailing / living wage": "You must pay workers at least a government-set wage rate, which is often higher than your normal pay. This raises your labor cost.",
    "Mandatory site visit / pre-bid": "You must attend a visit to the site or a pre-bid meeting. If you miss it, your bid can be thrown out.",
    "24/7 or after-hours": "The work may need nights, weekends or on-call response. That means extra staffing and overtime cost.",
    "Domestic-content rule (Buy America / TAA)": "Materials or products must be made in the USA (or in approved trade-deal countries). Imported goods may not be allowed.",
    "Retainage or slow payment terms": "The buyer may hold back part of your pay until the job is done, or pay late (45 to 90 days). Expect slower cash flow.",
    "Liquidated damages for late work": "You pay a set penalty for each day the work is late.",
    "Delivery terms (FOB / inside delivery)": "There are specific delivery rules, such as who pays freight, or delivery inside the building. These can add shipping cost.",
    "Escorted or restricted site access": "The site is secured, so you may need an escort or a badge to get in. Work can be slower and need more planning.",
    "Drug testing of workers": "Your workers must pass drug tests, or you must run a drug-free workplace program.",
    "Certified payroll / compliance reporting": "You must file regular payroll or compliance reports to prove you follow wage and workforce rules. This means extra paperwork.",
    "Permits and fees on the contractor": "You are responsible for getting and paying for permits, so add them to your price.",
    "Hazardous materials handling": "The job involves hazardous materials such as asbestos or lead paint. Special training, handling and disposal are likely needed.",
    "Fixed price, no escalation": "Your price is locked in. If material or labor costs rise, you absorb the increase.",
    "Warranty requirement": "You must stand behind the work or product for a set period and fix defects at your own cost.",
    "Brand-name / \"or equal\" spec": "The buyer names a specific brand. You can offer an equal product, but you must show it matches.",
    "Owner can terminate for convenience": "The buyer can cancel the contract at any time, even if you did nothing wrong. You are usually paid only for work done so far.",
    "Submittals / samples for approval": "You must send samples or documents for approval before starting or ordering. This can slow the schedule.",
    "Local / in-state preference": "The buyer may favor local or in-state businesses. Outside bidders can be at a disadvantage.",
    "Past performance / references": "The buyer will check your past jobs or references. Have similar projects and contacts ready.",
    "Quantities stated": "The notice states how much is wanted. Check you can supply that amount, and price the whole quantity.",
    "Quality / technical standards": "The product or work must meet named industry standards (such as ASTM, ISO, UL or NFPA). Ask your supplier for proof before you bid.",
    "Submission format / method": "The notice sets how your bid must be sent (sealed, electronic, a number of copies, signed or notarized). A bid in the wrong format can be rejected.",
    "Questions / amendment deadline": "Questions about the notice are only accepted until a set date, earlier than the bid deadline. Ask early.",
    "Delivery / completion timeline": "The work or goods are due within a set time after award. Check you can meet it.",
    "Payment terms": "The notice says when and how you get paid (for example net 30, or monthly invoices). Check it fits your cash flow.",
    "Required forms / compliance documents": "You must send extra paperwork with your bid (forms, affidavits, W-9, certificates). Missing one can disqualify the bid.",
    "Multi-year / renewal term": "The contract can run several years or be renewed. That is steady work, but your price is held for a long time."
  };
  var OPEN_ALL = "Open to all businesses";
  EXPLAIN[OPEN_ALL] = "When a notice says no set-aside is used, any company can bid, regardless of size or ownership status. You compete against larger firms, but you also don't need a special certification.";
  // "No Set aside used" (as SAM.gov words it) is shown as "Open to all businesses"
  root.asideLabel = function (s) { return /^\s*no set[- ]?aside( used)?\.?\s*$/i.test(String(s || "")) ? OPEN_ALL : s; };
  function explainFact(label) {
    label = String(label || "");
    if (EXPLAIN[label]) return EXPLAIN[label];
    var l = label.toLowerCase();
    if (/set-aside|only$/.test(l) || /\b(sdvosb|vosb|wosb|edwosb|hubzone|8\(a\)|small business|mbe|wbe|dbe|mwbe|sdvob)\b/.test(l)) {
      var s = [];
      // "Service-Disabled Veteran-Owned Small Business" is one category, not "small business" plus "veteran-owned"
      l = l.replace(/(owned|hubzone|8\(a\)|disadvantaged)\s+small business(es)?/g, "$1");
      if (/small business|\bsb\b/.test(l)) s.push("small businesses");
      if (/sdvosb|sdvob/.test(l)) s.push("service-disabled veteran-owned businesses");
      else if (/\bvosb\b/.test(l)) s.push("veteran-owned businesses");
      if (/edwosb/.test(l)) s.push("economically disadvantaged women-owned businesses");
      else if (/wosb/.test(l)) s.push("women-owned businesses");
      if (/hubzone/.test(l)) s.push("businesses in federally designated HUBZone areas");
      if (/8\(a\)/.test(l)) s.push("firms in the SBA 8(a) program");
      if (/mbe|minority/.test(l)) s.push("minority-owned businesses");
      if (/wbe/.test(l) && !/wosb/.test(l)) s.push("women-owned businesses");
      if (/dbe/.test(l)) s.push("disadvantaged businesses");
      var who = s.length ? s.join(", ") : "certain types of businesses";
      if (/subcontracting|goals/.test(l)) return "The winner is expected to give part of the work to " + who + " (shown as goals). Check whether you qualify or can team up with one.";
      var whoText = s.length > 1 ? s.slice(0, -1).join(", ") + " or " + s[s.length - 1] : who;
      return "The buyer set this contract aside: only " + whoText + " can bid. If your company does not officially hold this status, your bid will be rejected, so skip it.";
    }
    if (/optional pre-bid/.test(l)) return "There is a pre-bid meeting, but you do not have to attend. It is still a good chance to ask questions.";
    if (/eligibility not checked/.test(l)) return "The notice documents were not read, so we do not know who is allowed to bid. Open the notice to check.";
    return "";
  }
  root.explainFact = explainFact;
  // Chip labels cut off mid-phrase by older extraction ("... good standing (corporations and") lose the dangling fragment.
  root.cleanLabel = function (s) {
    s = String(s || "").trim();
    var o = s.lastIndexOf("("), c = s.lastIndexOf(")");
    if (o > c && o > 8) s = s.slice(0, o);
    return s.replace(/[\s,;:\-–]+$/, "").replace(/\s+(and|or|for|of|with|in|to|the|a|over|under)$/i, "").trim();
  };
  // Short display form of a chip label: drops the legal tail ("under the ...", "to the extent ...", "issued by ...") and a leading state name, caps at ~34 chars.
  // The full wording stays available through data-key (the click-for-meaning popup).
  var STATES = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";
  var STATE_RE = new RegExp("^(" + STATES + ")\\s+(?=\\w)", "i");
  root.shortLabel = function (s) {
    s = root.cleanLabel ? root.cleanLabel(s) : String(s || "").trim();
    var t = s.replace(/\s*\([^)]*\)?/g, "")
      .split(/,|;|\s+(?:under|pursuant|per|in accordance|as required|as defined|issued by|granted by|to the extent|that|which|who|if|when|where|with respect|in order|and|naming|including|showing|stating|demonstrating)\b/i)[0]
      .replace(STATE_RE, "")
      .replace(/^(?:a|an|the|valid|current|active|proof of|evidence of)\s+/i, "")
      .replace(/\s+(?:for|of|from|to|in|on|by|the|a|an|and|or|with)$/i, "")
      .trim();
    if (t.length < 4) t = s;
    if (t.length > 34) { t = t.slice(0, 34).replace(/\s+\S*$/, ""); while (/\s+(?:for|of|from|to|in|on|by|the|a|an|and|or|with|at)$/i.test(t)) t = t.replace(/\s+\S+$/, ""); }
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : s;
  };
  // Always returns a real sentence for a chip: a specific explanation when we know one, else one built from the wording itself.
  root.describeFact = function (label) {
    var known = explainFact(label);
    if (known) return known;
    var l = String(label || "").toLowerCase();
    if (/secretary of state|good standing|registered (to|with|in)|registration/.test(l)) return "Your company must be officially registered with the state, and in good standing (annual reports filed, fees paid), to win or hold this contract. Check your status with the state's Secretary of State office before you bid.";
    if (/licen[sc]e|licensed|permit/.test(l)) return "You need this license or permit to bid or do the work. If you do not hold it, get it first or team up with a company that does.";
    if (/certif|accredit/.test(l)) return "You need this certification or accreditation. Without it your bid can be rejected.";
    if (/insurance|liability|workers.? comp/.test(l)) return "You must carry this insurance. Confirm your policy meets the stated amounts and ask your broker for a certificate.";
    if (/bond|surety/.test(l)) return "A bond (a guarantee backed by a surety company) is required. It adds cost, and new companies can find it hard to qualify.";
    if (/\bsam\b|system for award|uei|cage|vendor regist|supplier regist|w-?9/.test(l)) return "You must be registered as a vendor (or send the stated form) before you can be paid. Registration can take days or weeks, so start early.";
    if (/gsa|schedule|sewp|contract vehicle|idiq/.test(l)) return "Only companies already on this contract vehicle can bid. If you are not on it, you cannot respond directly.";
    if (/experience|years|past performance|reference/.test(l)) return "The buyer wants proof of relevant experience. Have similar past jobs and references ready.";
    if (/clearance|background|fingerprint|citizen/.test(l)) return "Your staff must pass a background or security check before working for this buyer. Plan for the time and cost.";
    if (/tax|debar|suspen|compliance|affidavit|disclosure|ethic/.test(l)) return "You must be in good legal and tax standing and may need to sign a statement saying so. Gather these documents before the deadline.";
    return "The buyer requires \"" + String(label || "").trim() + "\" from bidders. Make sure your company meets this before bidding, and read the notice for the exact conditions.";
  };
  root.computeFacts = keyFacts;
  root.REQ_GROUPS = GROUPS;
  root.reqGroupOf = function (label) { return GROUP_OF[label] || ""; }; // "" = not a checklist item (e.g. a set-aside)
  root.scanText = scanText;
  if (typeof module !== "undefined" && module.exports) module.exports = { computeFacts: keyFacts, scanText: scanText, explainFact: explainFact, GROUPS: GROUPS, groupOf: groupOf };
})(typeof window !== "undefined" ? window : globalThis);
