// Bid-factor rules, shared by the page (script tag) and the server (require). The server precomputes each notice's
// factors from its full text so the page does not need the long "shall" lists up front.
(function (root) {
  var FACT_RULES = [
    { label: "TSA-checked workers",        sev: "hard", re: /\bTSA\b|transportation security administration|\bTWIC\b/i },
    { label: "Security clearance",         sev: "hard", re: /security clearance|secret clearance|top secret|\bpublic trust\b|\bNACI\b|\bCAC\b/i },
    { label: "Background checks / fingerprinting", sev: "hard", re: /background (check|investigation|screening)|fingerprint|criminal history|\bE-?Verify\b|\bbadg(e|ing)\b/i },
    { label: "License / certification",    sev: "hard", re: /\blicens(e|ed|ure)\b|certified by|certification required|\bOSHA[- ]?(10|30)\b|master (plumber|electrician)|\bEPA\b.*certif/i },
    { label: "Bid / performance bond",     sev: "cost", re: /(bid|performance|payment|surety)\s+(bond|security)|\bsurety\b|bonding/i },
    { label: "Insurance minimums",         sev: "cost", re: /\binsurance\b|general liability|workers.? comp/i },
    { label: "Prevailing / living wage",   sev: "cost", re: /prevailing wage|living wage|service contract (labor )?standards|\bSCA\b|davis[- ]bacon|wage determination|union|collective bargaining/i },
    { label: "Mandatory site visit / pre-bid", sev: "cost", re: /(mandatory|required)[^.]{0,60}(pre-?bid|site (visit|walk)|walk-?through|conference)|pre-?bid[^.]{0,40}mandatory/i },
    { label: "24/7 or after-hours",        sev: "cost", re: /24\s*\/\s*7|24[- ]hour|after[- ]hours|overnight|night shift|on-?call|emergency response/i },
    { label: "Past performance / references", sev: "info", re: /past performance|references|\bCPARS\b|years of experience|similar (projects|contracts)/i },
    { label: "Multi-year / renewal term",  sev: "info", re: /option (year|period)|base (year|period)|\b\d+[- ]year (contract|term)|renewal/i }
  ];
  var KEYWORD_ONLY = /^(NY|WY|DE|TXDOT)-/;
  function keyFacts(r) {
    var x = r.details || {};
    var src = [];
    // States whose notices carry no readable documents (NY, WY, DE, TXDOT) get a free keyword match on the title and scope line.
    var kw = !r.aiRead && KEYWORD_ONLY.test(String(r.id || ""));
    if (kw && r.title) src.push(r.title);
    if (r.scope) src.push(r.scope);
    (r.shall || []).forEach(function (s) { src.push(s.text); });
    (x.requirements || []).forEach(function (q) { src.push(q); });
    if (x.restriction) src.push(x.restriction);
    var out = [];
    FACT_RULES.forEach(function (rule) {
      for (var i = 0; i < src.length; i++) {
        if (rule.re.test(src[i])) { var f = { label: rule.label, sev: rule.sev, why: src[i] }; if (kw) f.kw = true; out.push(f); return; }
      }
    });
    return out;
  }
  root.computeFacts = keyFacts;
  if (typeof module !== "undefined" && module.exports) module.exports = { computeFacts: keyFacts };
})(typeof window !== "undefined" ? window : globalThis);
