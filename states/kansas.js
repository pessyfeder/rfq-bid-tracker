// Kansas: eSupplier "Public Bidding Events" (PeopleSoft), supplier.sok.ks.gov. Public, no login, no robots.txt;
// the Department of Administration terms of use only disclaim liability and note copyright (reviewed 2026-11-10).
// The page needs the session cookie handshake: the first GET answers 302 + Set-Cookie, and a client that does not
// send the cookie back lands on "You must have cookies enabled". With the cookie, the list page already holds the whole
// grid (no search POST needed): event name, agency (business unit), event ID, start and end. Each event also has a
// shareable detail URL (AUC_ID=...) that holds the description; bid package documents need a further POST and are not read.
const { requests, clean, toEastern, sleep, UA } = require("./common");

const BASE = "https://supplier.sok.ks.gov/psc/sokfsprdsup/SUPPLIER/ERP/c/";
const LIST = BASE + "SCP_PUBLIC_MENU_FL.SCP_PUB_BID_CMP_FL.GBL";
const DETAIL = (id) => BASE + "KS_FSCM_APP_PK.KS_SCP_PUB_BIDLST.GBL?Page=KS_SCP_PUB_BIDLST&Action=&&AUC_ID=" + encodeURIComponent(id);

// A tiny cookie-carrying GET that follows the portal's 302 hops by hand.
function session() {
  const jar = {};
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  return async function get(url) {
    for (let hop = 0; hop < 5; hop++) {
      const host = new URL(url).host; requests[host] = (requests[host] || 0) + 1;
      const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie() }, redirect: "manual", signal: AbortSignal.timeout(30000) });
      for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [kv] = c.split(";"); const i = kv.indexOf("=");
        if (kv.slice(i + 1)) jar[kv.slice(0, i)] = kv.slice(i + 1); else delete jar[kv.slice(0, i)];
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location"), url).href; continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${host}`);
      return res.text();
    }
    throw new Error("Too many redirects from supplier.sok.ks.gov");
  };
}

// "11/12/2026 02:00 PM CST" -> Eastern { due, dueTime }. The portal's default zone label is "CST" all year; it is Kansas Central time.
function stamp(s) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s || "");
  if (!m) return null;
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(+m[3], +m[1], +m[2], h, +m[5], "America/Chicago");
}

const span = (html, id) => {
  const m = new RegExp(`id=['"]${id.replace(/\$/g, "\\$")}['"][^>]*>([\\s\\S]*?)</span>`).exec(html);
  return m ? clean(m[1]) : "";
};

module.exports = {
  code: "KS", name: "Kansas",
  // The detail page is a PeopleSoft session page the generic reader cannot open; its description is already taken below.
  noPageReads: true,
  noPageReadsWhy: "Kansas eSupplier pages need a session cookie handshake the generic reader does not do",
  noPageReadsNote: "Eligibility not read: the bid package documents were not opened. See the event on the Kansas eSupplier portal.",
  async fetch() {
    const get = session();
    const html = await get(LIST);
    if (!/SCP_PUB_AUC_VW_AUC_NAME\$0|No results to display/i.test(html)) throw new Error("Bid list layout not recognised (grid missing)");
    const rows = [];
    for (let i = 0; i < 500; i++) {
      const id = span(html, `SCP_PUB_AUC_VW_AUC_ID$${i}`);
      if (!id) break;
      const when = stamp(span(html, `SCP_COSP_WK_FL_SCP_END_DATE_CHAR$${i}`));
      const start = stamp(span(html, `SCP_COSP_WK_FL_SCP_STRT_DATE_CHAR$${i}`));
      if (!/^EVT\d+$/.test(id) || !when) continue;
      rows.push({ id, title: span(html, `SCP_PUB_AUC_VW_AUC_NAME$${i}`), agency: span(html, `BUS_UNIT_AUC_VW_DESCR$${i}`), when, posted: start && start.due });
    }
    if (!rows.length) throw new Error("No rows parsed from the Kansas bid list");

    // Description from each event's own page; a failure just leaves a plain description.
    for (const r of rows) {
      await sleep(800);
      try {
        const d = await get(DETAIL(r.id));
        const m = /id=['"]SCP_P_AUCDTL_VW_DESCRLONG[^'"]*['"][^>]*>([\s\S]*?)<\/(?:span|textarea|div)>/i.exec(d);
        const txt = clean(d).replace(/\s+/g, " ");
        const at = txt.indexOf("Description ");
        r.description = (m && clean(m[1])) || (at >= 0 ? txt.slice(at + 12).split(/ Event Start Date /)[0] : "");
      } catch (e) { r.description = ""; }
    }

    return rows.map((r) => ({
      id: r.id.toLowerCase(),
      title: r.title,
      agency: r.agency,
      category: "No data",
      posted: r.posted && /^\d{4}-\d{2}-\d{2}$/.test(r.posted) ? r.posted : null,
      due: r.when.due, dueTime: r.when.dueTime,
      url: DETAIL(r.id),
      description: r.description.slice(0, 600) || `Kansas bidding event ${r.id}. Open it on the eSupplier portal for the description and bid package.`,
      region: "Kansas"
    }));
  }
};
