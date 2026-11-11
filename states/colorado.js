// Colorado: public "View Published Solicitations" in CGI Advantage VSS (colorado.gov/vss).
// No login and no feed/API: the page is a JavaScript app that talks to one JSON endpoint. We make the same
// guest calls the page makes (4 requests per run):
//   1. GET the app shell  -> guest session cookies + session_info (session id, page id, CSRF token)
//   2. POST pageOpen       -> carousel page (each response hands back the next page id to use)
//   3. POST pageOpen       -> "View Published Solicitations" (default filter "Open", first 20 rows)
//   4. POST dsAction show_lines (100 per page) -> up to 100 rows in one go
// If CGI changes the protocol this adapter will throw and the state shows as failed, not wrong.
const { http, instantToEastern } = require("./common");

const URL_ = "https://prd.co.cgiadvantage.com/PRDVSS1X1/Advantage4";
const PUBLIC_PAGE = "https://www.colorado.gov/vss";
const PAGE_SIZE = 100;
// SO_CAT_CD -> category label as shown on the page (codes 30/31 not yet seen with a label)
const CATEGORY = { "01": "Admin/Mgmt Svc", "05": "Bldg Equip/Svcs", "09": "Food", "18": "Misc Comm/Svc", "20": "Print Equip/Svc", "21": "Personal Svcs", "22": "Construction", "24": "Safety Prod/Svc" };

module.exports = {
  code: "CO", name: "Colorado",
  async fetch() {
    const shell = await http(URL_);
    const cookies = shell.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const html = await shell.text();
    const si = /"session_info":\{"session_id":"(\w+)","page_id":"(\d+)","csrf_token":"(\w+)"\}/.exec(html);
    const conv = shell.headers.get("adv-conversation-id");
    if (!si || !conv) throw new Error("Colorado VSS session info not found (layout changed?)");
    const st = { sid: si[1], pid: si[2], csrf: si[3], win: crypto.randomUUID(), req: 1 };

    async function post(type, body, code) {
      const res = await http(URL_, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", Accept: "application/json, text/plain, */*", Cookie: cookies,
          "Adv-Page-Id": st.pid, "Adv-Action-Type": type, "Adv-Window-Id": st.win, "Adv-Conversation-Id": conv,
          "Adv-Session-Id": st.sid, "Adv-Request-Id": String(st.req++), ...(code ? { "Adv-Action-Code": code } : {})
        },
        body: JSON.stringify({ ...body, session_info: { page_id: st.pid, csrf_token: st.csrf, session_id: st.sid } })
      }, 1);
      const j = await res.json();
      if (j.session_info) { st.pid = j.session_info.page_id; st.csrf = j.session_info.csrf_token || st.csrf; }
      return j;
    }

    await post("pageOpen", {
      action: { params: { targetLocation: "display", targetComponentType: "CustomCarouselPage" }, actionType: "navAction", targetQualifiedName: "vss.page.VAXXX03153" },
      key: "vss.page.VAXXX03150.viewManager.viewManagerActionGroup.carousalAction"
    });
    const first = await post("pageOpen", {
      action: { params: { targetLocation: "noDisplay", targetComponentType: "SystemInquiryPage", widgetId: String(Math.floor(Math.random() * 1e20)).padStart(21, "1") }, actionType: "pageOpen", targetQualifiedName: "vss.page.VVSSX10019" },
      key: "vss.page.VAXXX03153.carouselView.carousel.solicitations",
      viewState: { "vss.page.VAXXX03153": { editable: false, hidden: false, closed: false, required: false, protected: false } }
    });
    const ds = first.data && first.data.ds_data && first.data.ds_data.T1SO_SRCH_QRY;
    if (!ds || !first.checksum) throw new Error("Colorado VSS solicitation list not returned");
    let rows = ds.row_data || [];

    if (rows.length >= 20) { // the first page is full: ask for the larger page size
      const big = await post("dsAction", {
        action: { key: "vss.page.VVSSX10019.gridView1.group1.cardGrid.grid1pagination", actionType: "dsAction", actionCode: "show_lines", dsNameList: "T1SO_SRCH_QRY", genericParam_1: String(PAGE_SIZE), bypassPopupClose: false, isCarouselNavigation: true },
        checksum: { VIEW: { gridView1: first.checksum.VIEW.gridView1 }, DATASOURCE: { T1SO_SRCH_QRY: first.checksum.DATASOURCE.T1SO_SRCH_QRY }, DS_DATA: { T1SO_SRCH_QRY: "-1" } },
        viewState: first.viewState,
        data: { page_data: {}, ds_query_data: { T1SO_SRCH_QRY: { SHOW_TXT: "3" } }, ds_data: { T1SO_SRCH_QRY: { row_data: rows } } }
      }, "show_lines");
      const more = big.data && big.data.ds_data && big.data.ds_data.T1SO_SRCH_QRY && big.data.ds_data.T1SO_SRCH_QRY.row_data;
      if (more && more.length >= rows.length) rows = more;
      if (rows.length >= PAGE_SIZE) console.warn(`Colorado: ${rows.length} rows returned (page limit) - some open bids may be missing`);
    }

    const out = [];
    for (const r of rows) {
      const id = (/\]\[([^\]]+)\]\s*$/.exec(r.DOC_REF || "") || [])[1];
      if (!id || typeof r.SO_CLSNG_DT_TM !== "number") continue;
      const { due, dueTime } = instantToEastern(r.SO_CLSNG_DT_TM);
      const posted = typeof r.PUB_DT === "number" ? instantToEastern(r.PUB_DT).due : null;
      out.push({
        id, title: String(r.DOC_DSCR || id).trim(), agency: String(r.DEPT_NM || "State of Colorado").trim(),
        category: CATEGORY[r.SO_CAT_CD] || "No data",
        posted, due, dueTime,
        url: PUBLIC_PAGE,
        description: `${r.DOC_CD_CONCAT || ""}${r.BUYR_NM ? " - buyer " + r.BUYR_NM : ""}`.trim(),
        region: "Colorado"
      });
    }
    if (!out.length) throw new Error("No bids parsed");
    return out;
  }
};
