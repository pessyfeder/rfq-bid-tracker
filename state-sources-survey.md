# State RFQ sources: survey (2026-11-09, second pass)

Free sources only. Evidence levels:
- VERIFIED = fetched today and bid rows seen in the HTML or JSON.
- LISTING = a public bid-listing page exists (HTTP 200, no login), but rows were not confirmed parseable.
- LOGIN/JS = bids sit behind a login, or the page is a JavaScript app (needs a headless browser or a hidden endpoint).
- NO-BOTS = robots.txt says `Disallow: /` for all agents. Do not scrape; ask the state for a feed instead.
- BLOCKED = HTTP 403 or bot challenge.
- UNREACHABLE = timed out or reset from this machine (may be temporary).
Caveat: I fetched with curl and ignored certificate revocation checks. About 80 parallel requests caused false timeouts on the first run, so reruns were done 4 at a time.

## Tier 1: open-data API
| State | Source | Status |
|---|---|---|
| DE | data.delaware.gov `2hnj-zwix` "Open Bids" (Socrata JSON: contractnumber, contracttitle, opendate, deadlinedate, agencycode, unspsc, bidurl). Also `yhim-4378` closed, `bnup-azrk` not awarded. | VERIFIED |
| OK | data.ok.gov "Statewide Contracts & Solicitations Search" | Page reachable. robots.txt has no blanket block. API and Open-status rows NOT confirmed. |
| IL | Socrata `illinois-edp.data.socrata.com` `6rb8-ntpm` "Future Solicitations" | Upcoming only, not open bids |
| TX | data.texas.gov `qh8x-rm8r` "Official and Unofficial Bid Items" | Probably bid tabulations. NOT confirmed |
| MD | opendata.maryland.gov eMMA bids | Last updated 2019, unusable |

## Tier 2: public listing, scrapable
**Periscope "bso" platform** (one adapter, several states). URL: `/bso/view/search/external/advancedSearchBid.xhtml?openBids=true`
robots.txt on these sites only blocks `/craft`.
| State | Host | Status |
|---|---|---|
| NV | nevadaepro.com | VERIFIED (table of bid #, agency, buyer, description, opening date, status; filter on status) |
| NJ | njstart.gov | VERIFIED (24 dates in the server-rendered page) |
| OR | oregonbuys.gov | VERIFIED (25 dates) |
| IL | bidbuy.illinois.gov | VERIFIED (25 dates) |
| MA | commbuys.com | UNREACHABLE: timed out twice (may block this client). Same platform, so likely works. |

**Other**
| State | Source | Status |
|---|---|---|
| IN | in.gov/idoa/procurement/current-business-opportunities | VERIFIED: server-rendered with dates, event numbers, "Bid Documents" links |
| IA | bidopportunities.iowa.gov (open, closed, awarded views) | LISTING |
| MO | missouribuys.mo.gov/bid-board | LISTING; rows not in static HTML, probably loaded by JavaScript |
| MS | ms.gov/dfa/contract_bid_search/Bid | LISTING; DataTables, likely loaded by JavaScript |
| LA | wwwcfprd.doa.louisiana.gov/osp/lapac (by category or department) | LISTING; rows not found on the category index, need a deeper page |
| RI | purchasing.ri.gov/bidding/ExternalBidSearch.aspx | LISTING; search form, results need a form post |
| SC | apps.sceis.sc.gov/SCSolicitationWeb/solicitationSearch.do | LISTING; no rows returned to my query, parameters need checking |
| WY | ai.wyo.gov .../bid-opportunities | LISTING; rows not found in static HTML |
| ID | purchasing.idaho.gov/open-and-future-solicitations | LISTING; rows not found in static HTML |
| CT | portal.ct.gov/DAS/CTSource/BidBoard | LISTING; robots.txt blocks `/search-results/` only |
| AK | aws.state.ak.us/OnlinePublicNotices | LISTING; search form |
| HI | spo.hawaii.gov/for-vendors/bidding-opportunities | LISTING |
| ND | omb.nd.gov/doing-business-state/bidders/bidding-opportunities-and-resources | LISTING |
| WV | state.wv.us/admin/purchase/Bids | Reachable; text only, listing not inspected |
| NY | nyscr.ny.gov | Reachable, but no listing in the static page. State reply still pending. |

## Do not scrape / blocked
- NO-BOTS (robots.txt `Disallow: /` for all): TX (ESBD), PA (eMarketplace), UT (Bonfire), OH, AL.
- LOGIN/JS: AZ (redirects to login), OH (login redirect), NC eVP (Dynamics portal, read-only offline shell), WA WEBS (JS), FL VBS (JS), KY and MI (Advantage VSS), KS, GA (browser check), VA eVA, MT (Jaggaer), NM (Bonfire/Jaggaer), SD (ESM), WI, NE (page empty).
- BLOCKED: CA (403), CO (403), ME (403; also login-only since 2025-10), NH (403), TN (403), MN (bot challenge).
- AR is moving ARBuy to Ariba in 2026 (not probed).

## Not probed at all
AR, VT (page 404 at the URL tried; `bgs.vermont.gov/purchasing-contracting` still to check), plus deeper pages for the LISTING states above.

## Built (2026-11-09)
`fetch-states.js` runs adapters in `states/`: DE (`delaware.js`) and NV, NJ, OR, IL (`bso.js`). Output: `live-states.js`,
registered as source `states` in `service/feed.js`. First run: DE 30, NV 27, NJ 24, OR 179, IL 162 open notices (about 80 s).
Known quirks: OR lists county and city bids too (all tagged level "State"); DE publishes dates only (no due time);
the bso sites publish no dollar value. To add a state, write an adapter and list it in `fetch-states.js`.

## Recommended build order
1. DE (Socrata, proven, minutes of work).
2. Periscope bso adapter: NV, NJ, OR, IL (MA after retest). Four states from one adapter.
3. IN (static HTML).
4. Confirm the LISTING states one at a time, starting with IA, MS, ID, WY, RI, SC, LA.
5. Email the NO-BOTS and BLOCKED states asking for a feed; that is the only compliant free route.
Expected free coverage: about 10 states soon, 15–20 with effort. All 50 is not realistic without a paid feed.
Check each site's terms of use before building its adapter.
