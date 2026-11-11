// Oklahoma: the Oklahoma Supplier Portal (PeopleSoft, financials.ok.gov) has a public "Bidding Event Information" page
// (OMES: Supplier Portal > Public Bidding Events). It needs no login, only a session cookie, and financials.ok.gov has no robots.txt.
// The old ok.gov/dcs/solicit list holds only 2020-2021 items, so it is not used.
// The list is a server-rendered grid; each row's "Details" chevron is a PeopleSoft form postback (ICAction=SCP_COSP_WK_FL_DESCR$n)
// whose response carries the buyer, status and a long description. If OK suddenly returns nothing, check the element ids
// below (SCP_PUB_AUC_VW_*, SCP_P_AUCDTL_VW_*) first: they come from the PeopleSoft page definitions.
const { UA, requests, clean, decodeEntities, toEastern, sleep } = require("./common");

const LIST = "https://financials.ok.gov/psp/SOKLFP1DS/SUPPLIER/ERP/c/SCP_PUBLIC_MENU_FL.SCP_PUB_BID_CMP_FL.GBL";

function newSession() {
  const jar = {};
  const eat = (r) => {
    for (const c of r.headers.getSetCookie?.() || []) {
      const kv = c.split(";")[0], i = kv.indexOf("=");
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (v) jar[k] = v; else delete jar[k];
    }
  };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const send = async (url, init = {}) => {
    { const h = new URL(url).host; requests[h] = (requests[h] || 0) + 1; }
    const r = await fetch(url, { redirect: "manual", ...init, signal: AbortSignal.timeout(45000),
      headers: { "User-Agent": UA, Cookie: cookie(), ...(init.headers || {}) } });
    eat(r);
    return r;
  };
  // GET following the redirects PeopleSoft uses to set up the session; returns { html, url }.
  async function get(url) {
    for (let i = 0; i < 8; i++) {
      const r = await send(url);
      const loc = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).href; continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${new URL(url).host}`);
      return { html: await r.text(), url };
    }
    throw new Error("Too many redirects from the Oklahoma Supplier Portal");
  }
  async function post(url, fields) {
    const r = await send(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${new URL(url).host}`);
    return r.text();
  }
  return { get, post };
}

const span = (html, id) => {
  const m = new RegExp(`id='${id.replace(/\$/g, "\\$")}'[^>]*>([\\s\\S]*?)</span>`).exec(html);
  return m ? clean(m[1]) : "";
};
const hiddenFields = (html) => {
  const form = /<form[^>]*name=['"]win0['"][\s\S]*?<\/form>/i.exec(html);
  const fields = {};
  if (!form) return fields;
  for (const m of form[0].matchAll(/<input[^>]*type=['"]hidden['"][^>]*>/gi)) {
    const n = /name=['"]([^'"]+)/.exec(m[0]), v = /value=['"]([^'"]*)/.exec(m[0]);
    if (n) fields[n[1]] = decodeEntities(v ? v[1] : "");
  }
  return fields;
};
// "11/18/2026 03:00 PM CST" (portal time, Central) -> Eastern { due, dueTime }
function parseCentral(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s || "");
  if (!m) return null;
  let h = Number(m[4]) % 12; if (/pm/i.test(m[6])) h += 12;
  return toEastern(Number(m[3]), Number(m[1]), Number(m[2]), h, Number(m[5]), "America/Chicago");
}
const isoDate = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

module.exports = {
  code: "OK", name: "Oklahoma",
  // Event pages are PeopleSoft postbacks with no stable URL, so a plain page read would only see the list.
  noPageReads: true,
  noPageReadsWhy: "Oklahoma events open through a portal form postback; the bid package is inside the Supplier Portal",
  noPageReadsNote: "Eligibility not read: Oklahoma keeps solicitation documents inside the Supplier Portal. See the solicitation there.",
  async fetch() {
    const s = newSession();
    const { html, url } = await s.get(LIST);
    const rows = [];
    for (const m of html.matchAll(/id='SCP_PUB_AUC_VW_AUC_ID\$(\d+)'/g)) {
      const n = m[1];
      rows.push({
        n, id: span(html, `SCP_PUB_AUC_VW_AUC_ID$${n}`), title: span(html, `SCP_PUB_AUC_VW_AUC_NAME$${n}`),
        agency: span(html, `BUS_UNIT_AUC_VW_DESCR$${n}`), type: span(html, `SCP_PUB_AUC_VW_AUC_TYPE$${n}`),
        start: span(html, `SCP_COSP_WK_FL_SCP_STRT_DATE_CHAR$${n}`), end: span(html, `SCP_COSP_WK_FL_SCP_END_DATE_CHAR$${n}`)
      });
    }
    if (!rows.length) {
      if (/Bidding Event Information/.test(html) && /No data|0 rows/i.test(html)) return [];
      throw new Error("Unexpected response from the Oklahoma Supplier Portal (no bidding-event grid found)");
    }
    const out = [];
    let fields = hiddenFields(html);
    for (const r of rows) {
      const when = parseCentral(r.end);
      if (!r.title || !r.id || !when) continue;
      let description = "", buyer = "";
      try {
        // Re-posting the list's own form state works for every row; if a response is for some other event, refetch the list once.
        let d = await s.post(url, { ...fields, ICAction: `SCP_COSP_WK_FL_DESCR$${r.n}` });
        if (span(d, "SCP_P_AUCDTL_VW_AUC_ID$0") !== r.id) {
          fields = hiddenFields((await s.get(LIST)).html);
          d = await s.post(url, { ...fields, ICAction: `SCP_COSP_WK_FL_DESCR$${r.n}` });
        }
        if (span(d, "SCP_P_AUCDTL_VW_AUC_ID$0") === r.id) {
          const t = /<textarea[^>]*id='SCP_P_AUCDTL_VW_DESCRLONG\$0'[^>]*>([\s\S]*?)<\/textarea>/.exec(d);
          description = t ? clean(t[1]) : "";
        }
      } catch (e) { /* the list row is still worth keeping without its description */ }
      await sleep(400);
      out.push({
        id: r.id, title: clean(r.title), agency: r.agency || "Oklahoma agency",
        category: r.type || "No data", posted: isoDate(r.start),
        due: when.due, dueTime: when.dueTime, url: LIST, description, region: "Oklahoma"
      });
    }
    return out;
  }
};
