// West Virginia: Purchasing Division, wvOASIS "View Published Solicitations" (public, no login).
// wvOASIS is a CGI Advantage single-page app: a browser talks to one URL with JSON actions. We replay the same three
// actions a visitor triggers: open the published-solicitations page, search "Open" (Show Me = 3), show 100 per page.
// The server keeps the session in a cookie plus the session_info block from the first page. The host intermittently
// returns 503, so the whole session is retried. If the result is not the complete open list (a "+" count means more
// pages) we fail loudly rather than publish a partial list.
const { UA, requests, sleep, instantToEastern } = require("./common");

const URL_APP = "https://prd311.wvoasis.gov/PRDVSS1X1ERP/Advantage4";
const PAGE = "vss.page.VVSSX10019";
const DS = "T1SO_SRCH_QRY";
// Solicitation Category code table (from the page definition).
const CATS = {"10":"Consulting","11":"Educational","12":"Equip. Rental","13":"Equipment","14":"Financial","15":"Food","16":"Food service","17":"Fuels","18":"Furniture","19":"Highways","20":"Household Items","21":"Info Technology","22":"Insurance","23":"Laboratory","24":"Leased Space","25":"Legal","26":"Medical","27":"Miscellaneous","28":"Office Equip.","29":"Office Supplies","30":"Printing","31":"Public Safety","32":"Reclamation","33":"Service - Misc","34":"Service - Prof","35":"Telecomm","36":"Vehicles","01":"Agricultural","02":"Architect/Engr","03":"Athletic","04":"Audio/Video","05":"Auto Supply","06":"Building Supply","07":"Chemicals","08":"Clothing","09":"Construction"};

async function session() {
  const h = { "User-Agent": UA };
  requests["prd311.wvoasis.gov"] = (requests["prd311.wvoasis.gov"] || 0) + 1;
  const r = await fetch(URL_APP, { headers: h, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for prd311.wvoasis.gov`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const m = (await r.text()).match(/var moInitialResponse = (\{.*\});?\s*$/m);
  if (!m) throw new Error("wvOASIS start page not recognised (layout changed)");
  let si = JSON.parse(m[1]).session_info;
  if (!si || !si.session_id) throw new Error("wvOASIS session info missing");
  const post = async (body) => {
    requests["prd311.wvoasis.gov"] = (requests["prd311.wvoasis.gov"] || 0) + 1;
    const x = await fetch(URL_APP, { method: "POST", headers: { ...h, "Content-Type": "application/json;charset=UTF-8", Cookie: cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    if (!x.ok) throw new Error(`HTTP ${x.status} for prd311.wvoasis.gov`);
    const j = await x.json();
    if (j.session_info) si = j.session_info;
    return j;
  };
  const q = { TOP_LEVEL_KV_PAIRS_MAP: {} };
  await post({ action: { params: { targetLocation: "noDisplay", targetComponentType: "SystemInquiryPage" }, actionType: "pageOpen", targetQualifiedName: PAGE }, session_info: si, key: "vss.page.VAXXX03153.carouselView.carouselWV.solicitations", viewState: {} });
  const data = { page_data: {}, ds_query_data: { [DS]: { SHOW_TXT: "3" } } };
  await post({ action: { applicationAction: "search", backgroundAction: "userInitiated", key: `${PAGE}.gridView1.group1.cardSearch.searchActions.search`, actionType: "searchAction", actionCode: "search", dsNameList: DS, dataSource: DS, viewName: "gridView1", name: "search", isCarouselNavigation: true }, viewState: q, data, session_info: si });
  const res = await post({ action: { key: `${PAGE}.gridView1.group1.cardGrid.grid1pagination`, actionType: "dsAction", actionCode: "show_lines", dsNameList: DS, genericParam_1: "100", isCarouselNavigation: true }, viewState: q, data, session_info: si });
  const ds = res.data && res.data.ds_data && res.data.ds_data[DS];
  if (!ds || !Array.isArray(ds.row_data)) throw new Error("wvOASIS result not recognised (layout changed)");
  if (String(ds.total_count_suffix || "").includes("+")) throw new Error("wvOASIS list has more than one page (needs paging)");
  if (ds.row_data.length !== Number(ds.rows_total)) throw new Error(`Got ${ds.row_data.length} of ${ds.rows_total} rows`);
  return ds.row_data;
}

module.exports = {
  code: "WV", name: "West Virginia",
  noPageReads: true,
  noPageReadsWhy: "wvOASIS has no per-bid web page, only a session app",
  noPageReadsNote: "wvOASIS has no direct link to one bid. Open View Published Solicitations and search the solicitation number to see the documents.",
  async fetch() {
    let last, rows;
    for (let i = 0; i < 4 && !rows; i++) {
      try { rows = await session(); } catch (e) { last = e; await sleep(3000 * (i + 1)); }
    }
    if (!rows) throw last;
    const today = Date.now();
    return rows.filter((r) => Number(r.SO_CLSNG_DT_TM) > today).map((r) => {
      const ref = (/\[([A-Z]+-[^\]]+)\]\s*$/.exec(r.DOC_REF) || [])[1] || r.DOC_REF;
      const close = instantToEastern(Number(r.SO_CLSNG_DT_TM));
      const pub = r.PUB_DT ? instantToEastern(Number(r.PUB_DT)).due : null;
      const contact = [r.BUYR_NM && `Buyer: ${r.BUYR_NM}`, r.BUYR_EMAIL_AD, r.BUYR_PH_NO].filter(Boolean).join(", ");
      return {
        id: ref,
        title: r.DOC_DSCR,
        agency: r.DEPT_NM ? `State of West Virginia: ${r.DEPT_NM}` : "State of West Virginia",
        category: CATS[r.SO_CAT_CD] || "No data",
        posted: pub,
        due: close.due, dueTime: close.dueTime,
        url: URL_APP,
        description: `${ref} (${r.DOC_CD_CONCAT})${r.SO_STA === "M" ? ", amended" : ""}. ${contact}`.trim(),
        region: "West Virginia"
      };
    });
  }
};
