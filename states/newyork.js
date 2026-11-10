// New York State: NYS Contract Reporter (nyscr.ny.gov), the state's official procurement-ad listing.
// Public, server-rendered, no login, no robots.txt. The search page is a plain GET form (Status=Open, Top<=50, Skip, Sort),
// so the whole open list is ~18 small requests. The ad DETAIL pages need a free login, so rows link to /Ads/Details/<CR#>
// (it asks for a login, then lands on the ad) and the AI document read is skipped (noPageReads).
// Only ads someone can bid on are kept: sole/single-source notices, surplus-property sales, grant announcements and
// RFI/RFC notices are dropped. Contractor Ads (a prime contractor seeking subcontractors) are kept and labelled.
const { http, sleep, clean } = require("./common");

const BASE = "https://www.nyscr.ny.gov";
const PAGE = 50;
const SKIP_TYPES = /sole\/single source|surplus property|grant or notice of funds|requests for information/i;

// "11/10/2026" -> "2026-11-10"
const iso = (s) => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null; };

// The text of the value cell that follows a label such as "Ad type:" inside one list item.
const field = (item, label) => {
  const m = new RegExp(`${label}\\s*</div>\\s*<div class="px-2[^"]*"[^>]*>([\\s\\S]*?)</div>`).exec(item);
  return m ? clean(m[1]) : "";
};

module.exports = {
  code: "NY", name: "New York State",
  noPageReads: true,
  noPageReadsWhy: "NYS Contract Reporter ad pages need a login",
  noPageReadsNote: "The NYS Contract Reporter shows the full ad only to logged-in users, so this row is not read. Open the ad and log in (free) to see the solicitation.",
  async fetch() {
    const out = new Map();
    let total = null, skipped = 0;
    for (let skip = 0; skip < 5000; skip += PAGE) {
      const res = await http(`${BASE}/Ads/Search?Status=Open&DateFilter=All&Sort=DateDue&Top=${PAGE}&Skip=${skip}`);
      const html = await res.text();
      if (total === null) {
        const t = /All Open Opportunities:<\/span>\s*(\d+)/.exec(html);
        if (!t) throw new Error("Result page layout not recognised (open count missing)");
        total = Number(t[1]);
      }
      const items = html.split('class="opp-list-item').slice(1);
      if (!items.length) break;
      for (const it of items) {
        const id = (/data-ad-id="(\d+)"/.exec(it) || [])[1];
        const title = clean((/Title:<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/.exec(it) || [])[1]);
        const type = field(it, "Ad type:");
        if (!id || !title) continue;
        if (SKIP_TYPES.test(type)) { skipped++; continue; }
        const contractor = /Company:/.test(it);
        const due = iso(field(it, "Due date:"));
        if (!due) continue; // some ads publish no deadline
        out.set(id, {
          id, title,
          agency: field(it, contractor ? "Company:" : "Agency:"),
          category: field(it, "Category:") || type,
          posted: iso(field(it, "Issue date:")),
          due, dueTime: null,
          url: `${BASE}/Ads/Details/${id}`,
          description: `${type || "Ad"} (NYS Contract Reporter CR# ${id}).` + (contractor ? " Subcontracting opportunity posted by a prime contractor, not by the State." : ""),
          region: field(it, "Location:") || "New York State"
        });
      }
      if (items.length < PAGE) break;
      await sleep(700); // polite pacing
    }
    if (total > 0 && !out.size) throw new Error("No rows parsed");
    console.log(`  NY: ${total} open ads listed, ${skipped} non-bid types skipped, ${out.size} kept`);
    return [...out.values()];
  }
};
