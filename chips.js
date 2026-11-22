// Click a coloured chip (table and details page) for a plain-language meaning. Uses explainFact() from facts.js.
(function () {
  var SEL = ".fact, .elig.chip, .chips .chip";
  var css = document.createElement("style");
  css.textContent = SEL.split(",").map(function (s) { return s.trim() + "{cursor:pointer}"; }).join("") +
    ".chip-sel{outline:2px solid currentColor}" +
    "#chip-pop{position:absolute;z-index:900;max-width:320px;background:#fff;border:1px solid #cfd5de;border-radius:8px;box-shadow:0 6px 24px rgba(15,23,42,.2);padding:12px 14px;font:13px/1.45 system-ui,sans-serif;color:#2d3a48;font-weight:400}" +
    "#chip-pop b{display:block;margin-bottom:4px;color:#1f3a56}#chip-pop small{display:block;margin-top:8px;padding-top:6px;border-top:1px dashed #e4e4f0;color:#64748b;font-size:12px}";
  document.head.appendChild(css);
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var pop = null, cur = null;
  function close() { if (pop) { pop.remove(); pop = null; } if (cur) { cur.classList.remove("chip-sel"); cur = null; } }
  function open(chip) {
    var same = cur === chip; close(); if (same) return;
    if (chip.hasAttribute("title")) { chip.setAttribute("data-why", chip.getAttribute("title")); chip.removeAttribute("title"); } // no double tooltip
    var label = chip.textContent.replace(/^\s*[⚑⚠]\s*/, "").replace(/^Possible: /, "").trim();
    var key = label.replace(/^Must provide (\w)/, function (m, c) { return c.toUpperCase(); });
    var text = window.explainFact ? (window.explainFact(key) || window.explainFact(label)) : "";
    var why = (chip.getAttribute("data-why") || "").replace(/^Possible, keyword match: /, "");
    if (!text && /^(Who can bid|Restriction in the notice|Requirement noted in the notice|Stated in the notice title)$/.test(why)) why = "";
    pop = document.createElement("div"); pop.id = "chip-pop";
    pop.innerHTML = "<b>" + esc(label) + "</b>" + esc(text || "This is a condition found in the notice. Open the notice to read the exact wording.") +
      (why ? "<small>From the notice: " + esc(why) + "</small>" : "") +
      (chip.classList.contains("possible") ? "<small>Possible: matched by keyword only, the documents were not read.</small>" : "");
    document.body.appendChild(pop);
    var r = chip.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left + scrollX, scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8)) + "px";
    pop.style.top = (r.bottom + scrollY + 6) + "px";
    chip.classList.add("chip-sel"); cur = chip;
  }
  document.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest(SEL);
    if (c && !c.closest("#chip-pop")) { e.preventDefault(); e.stopPropagation(); open(c); return; }
    if (pop && !e.target.closest("#chip-pop")) close();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  window.addEventListener("scroll", close, { passive: true });
})();
