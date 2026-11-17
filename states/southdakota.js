// South Dakota: the Office of Procurement Management posts bids on the ESM Solutions "Central Bid Exchange Posting Board".
// The board is public (no login; the state links it from sd.gov/bhra) and is a single-page app over a JSON API,
// which is what this adapter reads: the open ("current") events list.
const { http, clean } = require("./common");
const { classify } = require("./classify");

const ID = "3444a404-3818-494f-84c5-2a850acd7779";
const HOST = "https://postingboard.esmsolutions.com";
const API = `${HOST}/api/postingBoard/${ID}`;
// Same zone parameters the page sends; with them the API returns Eastern wall-clock times (the page labels them ET).
const TZ = "browserGlobalTimeZoneNameId=Eastern%20Standard%20Time&browserGlobalTimeZoneName=America/New_York&browserOffset=-05:00:00";
const PAGE_SIZE = 50;

const json = async (url) => (await http(url, { headers: { Accept: "application/json" } }, 3)).json();

// "2026-11-16T18:00:00" (Eastern wall clock) -> { due: "2026-11-16", dueTime: "6:00 PM ET" }
function parseEastern(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(s || "");
  if (!m) return null;
  const h24 = Number(m[2]), h12 = h24 % 12 || 12;
  return { due: m[1], dueTime: `${h12}:${m[3]} ${h24 >= 12 ? "PM" : "AM"} ET` };
}

module.exports = {
  code: "SD", name: "South Dakota",
  // The event pages are a JavaScript app, so a plain page read would only see an empty shell.
  noPageReads: true,
  noPageReadsWhy: "South Dakota event pages are a JavaScript app; the documents are behind the ESM login",
  noPageReadsNote: "Eligibility not read: South Dakota keeps solicitation documents behind the ESM login. See the solicitation there.",
  async fetch() {
    const events = [];
    for (let pageNo = 0; pageNo < 20; pageNo++) {
      const j = await json(`${API}/currentevents?pageNo=${pageNo}&recordsPerPage=${PAGE_SIZE}&${TZ}`);
      if (!j || !Array.isArray(j.data)) throw new Error("Unexpected response from the South Dakota posting board (ESM)");
      events.push(...j.data);
      if (events.length >= (j.totalCount || 0) || !j.data.length) break;
    }
    const out = [];
    for (const e of events) {
      const when = parseEastern(e.eventDueDate);
      if (!e.eventName || !when) continue;
      out.push({
        id: clean(e.id),
        title: clean(e.eventName),
        agency: "South Dakota Office of Procurement Management",
        category: classify(clean(e.eventName)), // the id only says the bid type (IFB/RFP/RFQ), so guess the subject from the title
        posted: (e.publishedDate || "").slice(0, 10) || null,
        ...when,
        url: `${HOST}/${ID}/eventDetail/${e.eventId}`,
        description: "", // the per-event detail call is not served to non-browser clients, so the list row is all there is
        region: "South Dakota"
      });
    }
    return out;
  }
};
