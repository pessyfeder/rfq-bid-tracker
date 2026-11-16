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
    { label: "Prevailing / living wage",   sev: "cost", re: /prevailing wage|living wage|service contract (labor )?standards|\bSCA\b|davis[- ]bacon|wage determination|union|collective bargaining/i },
    { label: "Mandatory site visit / pre-bid", sev: "cost", re: /(mandatory|required)[^.]{0,60}(pre-?bid|site (visit|walk)|walk-?through|conference)|pre-?bid[^.]{0,40}mandatory/i },
    { label: "24/7 or after-hours",        sev: "cost", re: /24\s*\/\s*7|24[- ]hour|after[- ]hours|overnight|night shift|on-?call|emergency response/i },
    { label: "Local / in-state preference", sev: "info", re: /\b(local|in-state|resident) (vendor|bidder|business|preference)\b/i },
    { label: "Past performance / references", sev: "info", re: /past performance|references|\bCPARS\b|years of experience|similar (projects|contracts)/i },
    { label: "Multi-year / renewal term",  sev: "info", re: /option (year|period)|base (year|period)|\b\d+[- ]year (contract|term)|renewal/i }
  ];
  var KEYWORD_ONLY = /^(NY|WY|DE|TXDOT|ID|KS|PA)-/;
  // Short hover text: just the stretch of text around the match, not the whole paragraph.
  function excerpt(text, m) {
    text = String(text).replace(/\s+/g, " ").trim();
    var max = 120;
    var at = Math.max(0, text.indexOf(m[0]));
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
  function keyFacts(r) {
    var x = r.details || {};
    var src = [];
    // States whose notices carry no readable documents (NY, WY, DE, TXDOT, ID, KS, PA) get a free keyword match on the title and scope line.
    var kw = !r.aiRead && KEYWORD_ONLY.test(String(r.id || ""));
    if (kw && r.title) src.push(r.title);
    if (r.scope) src.push(r.scope);
    (r.shall || []).forEach(function (s) { src.push(s.text); });
    (x.requirements || []).forEach(function (q) { src.push(q); });
    if (x.restriction) src.push(x.restriction);
    var out = [];
    FACT_RULES.forEach(function (rule) {
      for (var i = 0; i < src.length; i++) {
        var m = rule.re.exec(src[i]);
        if (m) { var f = { label: rule.label, sev: rule.sev, why: excerpt(src[i], m) }; if (rule.gate) f.gate = true; if (kw) f.kw = true; out.push(f); return; }
      }
    });
    return out;
  }
  root.computeFacts = keyFacts;
  if (typeof module !== "undefined" && module.exports) module.exports = { computeFacts: keyFacts };
})(typeof window !== "undefined" ? window : globalThis);
