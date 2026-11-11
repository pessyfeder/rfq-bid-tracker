// Alaska: IRIS Vendor Self Service "View Published Solicitations" (iris-vss.alaska.gov), public guest session, no login.
// IRIS is the same CGI Advantage single-page app as Colorado and West Virginia, so this replays the same guest calls:
//   1. GET the app shell -> guest session cookies + session_info (session id, page id, CSRF token)
//   2. POST pageOpen     -> carousel page
//   3. POST pageOpen     -> "View Published Solicitations" (default filter "Open"; Show Me = 3)
// COVERAGE: IRIS is only part of Alaska. Most Alaska solicitations are posted on Online Public Notices
// (aws.state.ak.us/OnlinePublicNotices), whose search/paging POSTs sit behind DataDome bot protection (an "enable JS"
// challenge). We do not try to get around that, so those notices are NOT covered; see state-sources-survey.md.
// If CGI changes the protocol this adapter throws and the state shows as failed, not wrong.
const { http } = require("./common");
const { instantToEastern } = require("./common");

const URL_ = "https://iris-vss.alaska.gov/PRDVSS1X1/Advantage4";
// SO_CAT_CD -> label (from the page definition)
const CATS = {"100":"Computers","105":"Software","120":"Food","135":"Furniture","145":"Hardware Equip","150":"Hwy & Road","160":"Janitorial Svcs","170":"Lab Equip & All","185":"Equipment","195":"Medical","210":"Mis Commodities","215":"Misc Svcs","220":"Office All","230":"Paper Products","235":"Printing All","245":"Personal All","260":"Public Works","265":"Park Equip","270":"Construct Svcs","275":"Rental & Lease","285":"Safety","295":"School","310":"Library","315":"Sporting All","325":"Testing All","335":"Electrical","340":"Engineering","345":"HVAC","350":"Plumbing","355":"Welding","360":"Transit Equip","365":"Water & Sewer","375":"Env Cert Prods","005":"Admin Svcs","010":"Financial Svcs","015":"Management Svcs","020":"Agriculture","035":"Arts & Crafts","040":"Theatre","045":"Auto Prod & Svc","050":"Vehicles","060":"Building","075":"Clothing","080":"Laundry","090":"Comm Equip Svcs"};

module.exports = {
  code: "AK", name: "Alaska",
  noPageReads: true,
  noPageReadsWhy: "IRIS has no per-bid web page, only a session app",
  noPageReadsNote: "IRIS has no direct link to one bid. Open View Published Solicitations and search the solicitation number to see the documents.",
  async fetch() {
    const shell = await http(URL_);
    const cookies = shell.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const html = await shell.text();
    const si = /"session_info":\{"session_id":"(\w+)","page_id":"(\d+)","csrf_token":"(\w+)"\}/.exec(html);
    const conv = shell.headers.get("adv-conversation-id");
    if (!si || !conv) throw new Error("Alaska IRIS session info not found (layout changed?)");
    const st = { sid: si[1], pid: si[2], csrf: si[3], win: crypto.randomUUID(), req: 1 };

    async function post(type, body) {
      const res = await http(URL_, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", Accept: "application/json, text/plain, */*", Cookie: cookies,
          "Adv-Page-Id": st.pid, "Adv-Action-Type": type, "Adv-Window-Id": st.win, "Adv-Conversation-Id": conv,
          "Adv-Session-Id": st.sid, "Adv-Request-Id": String(st.req++)
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
    if (!ds || !Array.isArray(ds.row_data)) throw new Error("Alaska IRIS solicitation list not returned (layout changed?)");
    if (first.data.ds_query_data && first.data.ds_query_data.T1SO_SRCH_QRY && first.data.ds_query_data.T1SO_SRCH_QRY.SHOW_TXT !== "3") throw new Error("Alaska IRIS default filter is no longer 'Open'");
    // Fail loudly rather than publish a partial list (default page size is 20; paging is not implemented).
    if (String(ds.total_count_suffix || "").includes("+") || ds.row_data.length !== Number(ds.rows_total)) throw new Error(`Alaska IRIS returned ${ds.row_data.length} of ${ds.rows_total} rows (needs paging)`);

    const now = Date.now();
    // An empty open list is legitimate (returns []), unlike a parse failure above.
    return ds.row_data.filter((r) => Number(r.SO_CLSNG_DT_TM) > now).map((r) => {
      const ref = (/\]\[([^\]]+)\]\s*$/.exec(r.DOC_REF || "") || [])[1] || r.DOC_REF;
      const close = instantToEastern(Number(r.SO_CLSNG_DT_TM));
      const pub = typeof r.PUB_DT === "number" ? instantToEastern(r.PUB_DT).due : null;
      const contact = [r.BUYR_NM && `Buyer: ${r.BUYR_NM}`, r.BUYR_EMAIL_AD, r.BUYR_PH_NO].filter(Boolean).join(", ");
      return {
        id: ref,
        title: String(r.DOC_DSCR || ref).trim(),
        agency: r.DEPT_NM ? String(r.DEPT_NM).trim() : "State of Alaska",
        category: CATS[r.SO_CAT_CD] || "No data",
        posted: pub, due: close.due, dueTime: close.dueTime,
        url: URL_,
        description: `${ref} (${r.DOC_CD_CONCAT || r.DOC_CD})${r.SO_STA === "M" ? ", amended" : ""}. ${contact}`.trim(),
        region: "Alaska"
      };
    });
  }
};
