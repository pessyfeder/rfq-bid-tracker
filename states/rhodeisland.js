// Rhode Island: Division of Purchases "Other RI Bid Opportunities" (purchasing.ri.gov/bidding/ExternalBidSearch.aspx).
// Public, no login. It lists quasi-public agencies, cities/towns, schools, colleges and grants only; executive-branch
// state bids are in a login system and are NOT covered here.
// ASP.NET form: GET the search page for the hidden fields and session cookie, then POST them with every entity selected
// and status "Active(Scheduled)" to ExternalBidListing.aspx (the Search button is a cross-page post). One page, no paging.
const { http, clean, toEastern } = require("./common");

const BASE = "https://purchasing.ri.gov/bidding/";
const SEARCH = BASE + "ExternalBidSearch.aspx";
const LISTING = BASE + "ExternalBidListing.aspx";
const F = "ctl00$ContentPlaceHolder1$";

const decode = async (res) => { // UTF-8 for this client; fall back to Windows-1252 if the server ever sends that
  const buf = await res.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("windows-1252").decode(buf); }
};

// "11/10/2026 02:00 pm", "11/19/2026 10 AM", "11/24/2026 11:59pm" -> Eastern { due, dueTime }
function stamp(s) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i.exec(s || "");
  if (!m) return null;
  if (!m[4]) return { ...toEastern(+m[3], +m[1], +m[2], 12, 0, "America/New_York"), dueTime: null };
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(+m[3], +m[1], +m[2], h, +(m[5] || 0), "America/New_York");
}

const hidden = (html, name) => {
  const m = new RegExp(`name="${name.replace(/\$/g, "\\$")}"[^>]*value="([^"]*)"`).exec(html);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"') : "";
};

module.exports = {
  code: "RI", name: "Rhode Island",
  async fetch() {
    const first = await http(SEARCH);
    const cookie = (first.headers.getSetCookie ? first.headers.getSetCookie() : []).map((c) => c.split(";")[0]).join("; ");
    const page = await decode(first);
    const sel = /id="ctl00_ContentPlaceHolder1_lstbox_ExBiddingEntities"[\s\S]*?<\/select>/.exec(page);
    if (!sel || !hidden(page, "__VIEWSTATE")) throw new Error("Search page layout not recognised (form fields missing)");
    const entities = [...sel[0].matchAll(/<option[^>]*value="([^"]*)"/g)].map((m) => m[1]);
    if (entities.length < 20) throw new Error("Entity list looks wrong");

    const body = new URLSearchParams();
    for (const n of ["__EVENTTARGET", "__EVENTARGUMENT", "__LASTFOCUS", "__VIEWSTATE", "__VIEWSTATEGENERATOR", "__VIEWSTATEENCRYPTED", "__PREVIOUSPAGE", "__EVENTVALIDATION"]) body.append(n, hidden(page, n));
    body.append(F + "ddl_ExBiddingGroup", "All External Bidding Groups");
    body.append(F + "chkbox_ExSelectAll", "on");
    for (const e of entities) body.append(F + "lstbox_ExBiddingEntities", e);
    body.append(F + "lstbox_ExBidStatus", "Active(Scheduled)");
    body.append(F + "btn_ExSearch", "Search");
    const res = await http(LISTING, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: SEARCH, ...(cookie ? { Cookie: cookie } : {}) } });
    const html = await decode(res);

    const count = /lbl_RowsNumber"[^>]*>(?:\s*<[^>]+>)*\s*(\d+)/ // wrapped in <b><font> for some user agents.exec(html);
    if (!count) throw new Error("Result page layout not recognised (row count missing)");
    const rows = [];
    for (const tr of html.slice(html.indexOf("GV_ExBidSearch")).split(/<tr[\s>]/i).slice(1)) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (cells.length < 9) continue;
      const link = /href="([^"]*ViewExternalBid\.aspx[^"]*)"/i.exec(cells[2]);
      const number = clean(cells[2]);
      const when = stamp(clean(cells[1]));
      if (!link || !number || !when) continue;
      let url;
      try { url = new URL(link[1].replace(/&amp;/g, "&"), BASE).href; } catch { continue; }
      if (!/^https:\/\//.test(url)) continue;
      rows.push({ number, title: clean(cells[4]), group: clean(cells[5]), entity: clean(cells[6]), when, url });
    }
    if (Number(count[1]) > 0 && !rows.length) throw new Error("No rows parsed");

    // Addenda are separate rows ("27-008A1" for "27-008"). Fold each into its parent: keep the parent, take the latest deadline.
    const key = (r) => `${r.entity}|${r.number}`.toLowerCase();
    const byKey = new Map(rows.map((r) => [key(r), r]));
    const out = new Map();
    for (const r of rows) {
      const m = /^(.*?)\s*A\d+$/i.exec(r.number);
      const parent = m && byKey.get(`${r.entity}|${m[1]}`.toLowerCase());
      const base = parent || r;
      const cur = out.get(key(base)) || { ...base, addenda: 0 };
      if (parent) { cur.addenda++; if (`${r.when.due}` > cur.when.due) cur.when = r.when; }
      out.set(key(base), cur);
    }

    return [...out.values()].map((r) => ({
      id: `${r.entity}-${r.number}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
      title: r.title,
      agency: r.entity,
      category: r.group || "No data",
      posted: null,
      due: r.when.due, dueTime: r.when.dueTime,
      url: r.url,
      description: `Solicitation ${r.number}${r.addenda ? `, ${r.addenda} addendum row(s) folded in (latest deadline shown)` : ""}. Posted by ${r.group || "a Rhode Island entity"}; not a state-agency bid.`,
      region: "Rhode Island"
    }));
  }
};
