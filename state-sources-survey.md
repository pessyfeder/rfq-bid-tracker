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
| MA | commbuys.com | VERIFIED (852 open; one page blocked by a local filter) |

**Other**
| State | Source | Status |
|---|---|---|
| IN | in.gov/idoa/procurement/current-business-opportunities | VERIFIED: server-rendered with dates, event numbers, "Bid Documents" links |
| IA | bidopportunities.iowa.gov (open, closed, awarded views) | LISTING |
| MO | missouribuys.mo.gov/bid-board | LISTING; rows not in static HTML, probably loaded by JavaScript |
| MS | ms.gov/dfa/contract_bid_search/Bid | LISTING; DataTables, likely loaded by JavaScript |
| LA | wwwcfprd.doa.louisiana.gov/osp/lapac (by category or department) | LISTING; rows not found on the category index, need a deeper page |
| RI | purchasing.ri.gov/bidding/ExternalBidSearch.aspx | ADAPTER (`states/rhodeisland.js`, 2026-11-10), PARTIAL: quasi-public, city/town, school, college and grant bids only (30 open); executive-branch state bids are in a login system and are not covered (planned route: Ocean State Procures vendor email alerts, listed in email-alert-states.pdf; the OSP Bid Board host's TLS certificate does not verify, so it is not fetched). Two requests per run (GET form, POST to ExternalBidListing.aspx with all entities and status Active). Addendum rows (e.g. 27-008A1) are folded into the parent with the latest deadline. |
| SC | apps.sceis.sc.gov/SCSolicitationWeb/solicitationSearch.do | LISTING; no rows returned to my query, parameters need checking |
| WY | ai.wyo.gov (Google Sites) -> publicpurchase.com/gems/wyominggsd,wy/buyer/public/publicInfo | ADAPTER (`states/wyoming.js`, 2026-11-10): 12 open. The Google Sites page only points to Public Purchase; its attached sheets are award history (not used). The Public Purchase listing is JavaScript-written with decoy spans; the adapter drops the ids named in the page's own `action(...)` hide calls and joins the rest, and fails loudly if the layout changes. Its robots.txt answered with a redirect; Public Purchase terms not reviewed. |
| ID | purchasing.idaho.gov/open-and-future-solicitations | LISTING; rows not found in static HTML |
| CT | portal.ct.gov/DAS/CTSource/BidBoard | LISTING; robots.txt blocks `/search-results/` only |
| AK | aws.state.ak.us/OnlinePublicNotices | LISTING; search form |
| HI | spo.hawaii.gov/for-vendors/bidding-opportunities | LISTING |
| ND | omb.nd.gov/doing-business-state/bidders/bidding-opportunities-and-resources | LISTING |
| WV | www.state.wv.us/admin/purchase/Bids/ | BUILT 2026-11-10 (states/westvirginia.js, 70 open): replays the wvOASIS action protocol over plain HTTP (open page, search Open, 100 per page), retried on 503. Earlier note: the daily pages are "Bids Received on <date>": solicitation number, then bid PDFs and bidder names. They are bid openings (results), with no title, agency or deadline, so they list closed solicitations, not open ones. Open WV bids are in wvOASIS VSS (probed 2026-11-10): wvoasis.gov/vss/ links to prd311.wvoasis.gov/PRDVSS1X1ERP/Advantage4, a CGI Advantage single-page app. The public "View Published Solicitations" list works without login, but only as a stateful JSON/session app (no plain HTML or GET listing), so an adapter would mean replaying its action protocol. The host intermittently returns 503 (also for /robots.txt), and wvoasis.gov/robots.txt is a 404 (no rules). Still PARKED: feasible only with a browser-driven or reverse-engineered session client; not built. |
| NY | www.nyscr.ny.gov/Ads/Search | ADAPTER (`states/newyork.js`, 2026-11-10). The earlier "no listing" note was wrong: the search is a server-rendered GET form (Status=Open, Top=50, Skip=n), no robots.txt, no bot check; 18 requests give all ~886 open ads. Kept: ads with a due date that can be bid on (General, Contractor Ads = subcontracting, discretionary/MWBE/continuous procurements; ~736). Dropped: sole-source, surplus, grant and RFI/RFC ads. Ad detail pages need a free login, so rows link to /Ads/Details/<CR#> and are not AI-read. Supersedes `fetch-ny-state.js` (removed). Logged-in reads are ruled out: the login form uses reCAPTCHA (v3), which we do not work around, so detail pages, deadline times and AI reads are not available. The site's /Home/Policies page says content is copyright-protected and copying needs written permission from ESD (case by case); it says nothing about automated access. Listing use stands on the pages being public with no robots.txt; no permission request has been sent. Checked 2026-11-11: data.ny.gov (Socrata catalog search for solicitation / bid / RFP / contract reporter / invitation for bid) has NO open-solicitation dataset; only award and spend reports (Procurement Report for State/Local Authorities, LDCs, IDAs, etc.) and one MTA 2018-19 solicitation list, so it adds nothing for open bids. OGS bid calendar (ogs.ny.gov/procurement/bid-opportunities) returns a Cloudflare 403 challenge, so not used. NYSCR email subscriptions (category/keyword) would only repeat what the listing already gives (title, agency, category, dates, link) and need an account behind reCAPTCHA, so not built; the Gmail IMAP reader could take them later if ever wanted. |

## Do not scrape / blocked
- NO-BOTS (robots.txt `Disallow: /` for all): TX (ESBD), PA (eMarketplace), UT (Bonfire), OH, AL.
- LOGIN/JS: AZ (redirects to login), OH (login redirect), NC eVP (Dynamics portal, read-only offline shell), WA WEBS (JS), KY and MI (Advantage VSS), KS, GA (browser check), VA eVA, MT (Jaggaer), NM (Bonfire/Jaggaer), WI.
- BLOCKED: CA (403), CO (403), ME (403; also login-only since 2025-10), NH (403), TN (403), MN (bot challenge).
- AR is moving ARBuy to Ariba in 2026 (not probed).

## Not probed at all
AR, VT (page 404 at the URL tried; `bgs.vermont.gov/purchasing-contracting` still to check), plus deeper pages for the LISTING states above.

## Built
`fetch-states.js` runs one adapter per state in `states/` and writes `live-states.js` (source `states` in `service/feed.js`).
| State | Adapter | Open notices (2026-11-10) |
|---|---|---|
| DE | `delaware.js` (Socrata API) | 30 |
| IN | `indiana.js` (HTML table) | 53 |
| IA | `iowa.js` (JSON endpoint) | 47 |
| LA | `louisiana.js` (one HTML page per category, about 100 s) | 126 |
| MS | `mississippi.js` (DataTables POST, needs the full parameter set) | 76 |
| SC | `southcarolina.js` (form POST plus session, 9 pages) | 132 |
| ID | `idaho.js` (WordPress JSON; many close dates are only *anticipated*) | 10 |
| KS | `kansas.js` (PeopleSoft list plus one detail page per event) | 35 |
| NV, NJ, OR, IL, MA | `bso.js` (Periscope pages) | 27, 24, 179, 162, 852 (partial) |
Quirks: OR lists county and city bids (all tagged "State"); DE and ID publish dates only; LA links to the solicitation PDF;
IN links to its listing page. MA works (852 open on 2026-11-10); its portal is slow (about 10 s a page, 36 pages) and a network content filter blocks one page (rows 725-749), so MA is reported as partial.
To add a state, write an adapter and list it in `fetch-states.js`.
| SD | `southdakota.js` (ESM posting board JSON list; no login; no descriptions) | 34 |

VT is also built: `vermont.js` reads the OPC "Current Bid Listings" page (9 open on 2026-11-10); each notice links to its solicitation PDF.
AR was checked and not built: ARBuy's Periscope page loads but lists 0 open bids (the state is moving to a new system).
Draft emails for the states that forbid automated access are in `state-feed-requests.md` (sent by the user as of 2026-11-10; replies pending).

TX: ESBD offers no feed and forbids automated reads; the Comptroller confirmed (2026-11-10) the only route is a manual CSV export. Policy: nothing manual is kept, so the CSV import was removed. TxDOT notices come automatically from Texas open data (`states/txdot.js`).
PA replied: eAlerts email is the only route; the user must subscribe first.

PA (2026-11-10): `states/pennsylvania.js` reads the eAlert emails automatically over IMAP from a dedicated Gmail account when `PA_GMAIL_USER` and `PA_GMAIL_APP_PASSWORD` are set. WAITING: the app password has not been created yet (2-Step Verification step), so PA shows no notices; there is no manual route. The alert has no due date, so each notice gets the placeholder 2099-12-31, shown as "See eMarketplace", with a link built from the ID (`emarketplace.state.pa.us/Solicitations.aspx?SID=<ID>`). Pages are never fetched. Tested only against a fake IMAP server until the first real login.

## Public-list probe (2026-11-10)
- AZ: app.az.gov/robots.txt is `Disallow: /` (NO-BOTS). Do not scrape; request a feed.
- MT: public events are on bids.sciquest.com (Jaggaer); its robots.txt is `Disallow: /` (NO-BOTS). One page was fetched before the robots.txt was read; nothing more was fetched.
- WI: vendornet.wi.gov (no robots.txt) is a Blazor Server app, so no plain HTML/JSON listing; not built.
- KS: BUILT (`states/kansas.js`). The earlier note was wrong: the public list page (`SCP_PUBLIC_MENU_FL.SCP_PUB_BID_CMP_FL.GBL`) holds the full grid once the cookie handshake (302 + Set-Cookie, send it back) is done; no search POST needed. No robots.txt. Terms of use (admin.ks.gov/terms-of-use) only disclaim liability and note copyright, no ban on automated access. 35 open on 2026-11-10; each event has a shareable detail URL (`AUC_ID=EVT...`) read for the description. Bid package documents need a further POST and are not read (rows stay "Not read").
- NE: BUILT (`states/nebraska.js`, 2026-11-10). The earlier "page empty" was the old statecontracts/nebraskabuys hosts (awards only / no longer resolves). Open bids are a server-rendered table at das.nebraska.gov/materiel/bid-opportunities.html (robots.txt does not cover /materiel/, no login); 4 open with a due date, open-ended "Continous" rows skipped. No due time published. AI-read from each notice page and its PDF/Word attachments (generic reader, same-host links; 4 of 4 read 2026-11-10). The "Public Records Request" PDF linked from every page is treated as boilerplate.
- FL: BUILT (`states/florida.js`). The old VBS is archival, but its replacement, the MyFloridaMarketPlace Vendor Information Portal (vendor.myfloridamarketplace.com), is an Angular app over a public JSON API (POST `/mfmp/pub/search/bids` with `Accept: application/json`, detail at `/detail?id=`). No login, no robots.txt (404). The search returns nothing without a filter, so it asks for status OPEN. Only ITB/ITN/RFP/RFI/RSQ are kept (103 open on 2026-11-10); the shareable link is `/search/bids/detail/<advertisementId>`. Attached documents are not read.
- MO: BUILT (`states/missouri.js`, 2026-11-11). Bids moved to MOVERS (Oracle Fusion), but the public Solicitation Abstracts page needs no login and reads a guest REST resource: GET `ewqg.fa.us8.oraclecloud.com/fscmRestApi/resources/11.13.18.05/supplierNegotiationAbstracts?finder=RowFinderByBU;ProcurementBUId=300000005255687&q=NegotiationStatusCode='ACTIVE'`. No robots.txt (404). 59 open on 2026-11-11 (4,084 total incl. closed). Rows link to the listing page (no per-solicitation URL); documents are not read. FIRST PLACE TO LOOK if MO starts failing: the Oracle REST version `11.13.18.05` is pinned in `states/missouri.js` and could change; read the current version from the listing page's own `/fscmRestApi/rest/rv:<id>/en/<version>/...` request in the browser network tab.
- VA (eVA open data is historical) moved to the email-alert route 2026-11-11 (subscribe to eVA alerts; see email-alert-states.pdf).
- VA retried 2026-11-10: the open-bid page (VBO, mvendor.cgieva.com/Vendor/public/AllOpportunities.jsp) is public but behind an AWS WAF JavaScript challenge (HTTP 202, empty body, x-amzn-waf-action: challenge), so a plain fetch gets nothing; not bypassing it. data.virginia.gov CKAN datastore_search works without login, but eVA Procurement Data 2026/2027 are purchase-order lines (vendor, NIGP, price), no solicitations or due dates. Still parked.
- NM retried 2026-11-10: the GSD site (generalservices.state.nm.us, robots.txt only blocks wp-admin/calendar) has no bid list of its own; "Active Procurements" just links to Jaggaer (`bids.sciquest.com/apps/Router/PublicEvent?CustomerOrg=StateOfNewMexico&tab=PHX_NAV_SourcingOpenForBid`). That page loads without login, but `bids.sciquest.com/robots.txt` is `User-agent: * / Disallow: /`, so it is NO-BOTS; not built. (It is Jaggaer, not Bonfire; the earlier note was wrong on that.)

## Tried and parked
- OK: the public list works (GET `ok.gov/dcs/solicit/app/solicitationSearch.php?status=open-pending`, then `?page=N` with the session cookie), but it holds only old items: of 155 rows, 153 are "Pending Award" and the 2 "Open" ones closed in 2020 and 2021. Current Oklahoma bids are not published there, so no adapter was built.
- CT, AK, HI, ND: ASP.NET form pages or other systems; each needs form-post reverse engineering for few notices.

## Next
1. MA: ask the filter admin to allow commbuys.com so the one blocked page (rows 725-749) can be read.
2. Email the NO-BOTS and BLOCKED states asking for a feed; that is the only compliant free route.
3. VT, AR and the parked states if more coverage is wanted.
Expected free coverage: about 13 states now. All 50 is not realistic without a paid feed.
