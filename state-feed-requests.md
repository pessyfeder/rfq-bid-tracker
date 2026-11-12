# Feed requests to states that forbid automated access

These five states publish `Disallow: /` in robots.txt for their bid sites, so we should not scrape them.
The compliant free route is to ask each for a feed, an API, a data download, or written permission to read the
public bid list once a day. **These were sent by the user (as of 2026-11-10); replies: TX and PA answered 2026-11-10 (see below); others pending.** Fill in the [bracketed] parts and
confirm each address first, since several came from search results and some may be out of date.

## Template

Subject: Request for a data feed of open solicitations ([State] [portal name])

Hello,

I work at [company], a [small business] that bids on state contracts. We keep a small internal tracker of open
solicitations so we do not miss ones that fit our work.

Does [portal name] offer any of the following for open solicitations?
1. an RSS feed, API, or data download (CSV/JSON) of current open solicitations, or
2. an email digest we can subscribe to with a single mailbox, or
3. permission to read the public solicitation list automatically, once a day, at low volume.

If any of these exist, could you point me to the documentation or terms? If none do, could you tell me the
preferred way to get notified of new solicitations? We would only use the data to track bids for our own company
and would link back to your portal for every solicitation.

Thank you,
[Name], [title], [company], [phone], [email]

## Where to send

Verified = the address appears on the state's own page when fetched on 2026-11-10.

| State | Portal | Where to ask | Status |
|---|---|---|---|
| Texas | ESBD (txsmartbuy.gov/esbd) | ESBDsupport@cpa.texas.gov (512-463-3034, option 1); spd.outreach@cpa.texas.gov | Verified on comptroller.texas.gov/purchasing/contact/outreach.php. Texas's published APIs cover tax data, not ESBD. |
| Pennsylvania | PA eMarketplace | gs-procure@state.pa.us (on emarketplace.state.pa.us); srmhelp@pa.gov for the supplier portal | Verified. **Free route that already exists:** DGS "e-Alert" emails notify the public of upcoming procurement opportunities (dgs.internet.state.pa.us/EAlerts_V2). |
| Utah | Utah Public Procurement Place (Bonfire) | U3PAdmin@utah.gov (U3P admin team); or the contact form on purchasing.utah.gov/contact-us | Not verified: the site hides its addresses from automated reads. Use the contact form. |
| Ohio | OhioBuys (now on an Ivalua login system) | OBM.ContactCenter@obm.ohio.gov (on the OhioBuys page); das.statepurchasing@das.ohio.gov | The first is verified but is a help desk for system problems. The second is from older documents, unverified. procure.ohio.gov no longer resolves. |
| Alabama | Alabama Buys | alabamabuys@procurement.alabama.gov, (334) 353-0700 (Mon-Fri 9am-4pm CST) | Verified: the Alabama Buys help desk replied from this address (the older purchasing.alabama.gov address was unverified). **Answered, no feed offered:** the reply only suggested creating an AL BUYS account to use the in-portal solicitation tracking. That is a manual login flow, so it does not fit the automatic-sources rule. Open question: whether the portal tracking sends notification emails that could be read like the PA e-Alerts, and whether Alabama has any API or bulk export. |

## Also worth asking (blocked to automated requests, not forbidden)
California (Cal eProcure), Maine, New Hampshire, Tennessee, Minnesota returned errors or bot challenges.
The same template works; for these, ask for permission or a feed rather than a way around the block.

## Replies received (2026-11-10)
- **Texas (SPD, Comptroller):** no data feed from ESBD. Search results can be exported as CSV from the site (limit 20,000 rows). Posted solicitations can be listed on SmartBuy: Vendor > ESBD Bid Opportunities > Status = Posted (filter by start/end date). The CSV export is manual, so it is not used (policy: only automatic sources). TxDOT notices are read automatically from Texas open data instead.
- **Pennsylvania (DGS Supplier Services):** the only notification route is eAlerts (email of open solicitations). Sign-up instructions are on the Supplier Service Center page; the e-Alerts login is dgs.internet.state.pa.us/EAlerts_V2/Login.aspx, with an "E-Alerts Guide" PDF. Bidding help: srmhelp@pa.gov.

## Maryland (eMMA) - sent, replied: no feed (2026-11-12)

**Reply (eMMA Helpdesk, DGS, 2026-11-12):** the Public Solicitations page is public and searchable by hand, but the eMMA
Helpdesk "does not currently provide an approved API or automated data feed". So there is no automatic source for Maryland
(robots.txt also forbids automated reads). Permanently excluded under the only-automatic-sources policy; re-check only if
the state announces a feed or reopens its open data bid sets. The draft below is kept for reference.

Why: opendata.maryland.gov only has eMMA bids through FY2019 (last update 2019-07-02), and emma.maryland.gov
publishes `Disallow: /` in robots.txt behind a browser check, so we do not read it automatically.

To: emma.helpdesk@maryland.gov (listed in the eMMA user guides; confirm it is still current, or use the eMMA Knowledge Portal contact link on procurement.maryland.gov)

Subject: Request for a data feed of open solicitations (Maryland eMMA)

Hello,

I work at [company], a [small business] that bids on state contracts. We keep a small internal tracker of open
solicitations so we do not miss ones that fit our work.

We found that the eMaryland Marketplace bid datasets on opendata.maryland.gov stopped updating in 2019, and that
eMMA's robots.txt asks automated tools not to read the site. So we would like to ask the supported way to get
current open solicitations. Does eMMA offer any of the following?
1. an RSS feed, API, or data download (CSV/JSON) of current open solicitations, or a current replacement for the
   open data bid datasets, or
2. an email digest we can subscribe to with a single mailbox, or
3. permission to read the public solicitation list automatically, once a day, at low volume.

If any of these exist, could you point me to the documentation or terms? If none do, could you tell me the
preferred way to get notified of new solicitations? We would only use the data to track bids for our own company
and would link back to eMMA for every solicitation.

Thank you,
[Name], [title], [company], [phone], [email]

## Colorado: adapter in use now, feed request pending
**Status (2026-11-11):** Colorado is already tracked (`states/colorado.js`, 69 open bids), but through a workaround, so we
still want an official feed. The request has NOT been sent yet.

**What the workaround is.** Colorado's public bid list (colorado.gov/vss, "View Published Solicitations") is a
JavaScript app (CGI Advantage VSS) with no documented feed, API or export. The adapter makes the same guest requests the
page itself makes: it starts a guest session, opens the solicitations page, and asks for 100 rows. No login, and the
volume is four requests per run. It reads only what any visitor sees.

**Why it is fragile.** Those requests use CGI's internal, undocumented message format (session and CSRF tokens,
checksums, internal page and table names). CGI can change that at any release without notice. When it does, the adapter
throws and Colorado shows as **failed** in the status (other states are unaffected, and it never shows wrong data
silently). Fixing it means re-capturing the page's traffic in a browser and updating the adapter, about half an hour.
We expect this to happen within a year or two, though not in any given week.

**What we are asking for.** The same template above, for any of: an RSS feed, API or CSV/JSON download of open
solicitations; an email digest to a single mailbox; or written permission to read the public list once a day.
Also mention that we currently read the guest page automatically at low volume and ask whether that is acceptable.
A documented feed would replace the adapter; until one exists, keep the adapter.

**Where to ask.** Not yet verified. Use the "Contact Us" button on the VSS page (colorado.gov/vss), the VSS support
link on the same page, or the State Purchasing and Contracts office. Confirm the address on the state's own page
before sending, and add the sender's details to `state-feed-requests.local.md` (not this public file).

**If a reply arrives:** record it under "Replies received", then either switch `colorado.js` to the official feed or,
if they object to the guest-page reads, remove the adapter (delete `states/colorado.js` and its entry in `fetch-states.js`).

## Alaska: partial adapter in use now, waiting for a feed reply
**Status (2026-11-11):** Alaska is tracked only partly (`states/alaska.js`, 2 open bids from the IRIS Vendor Self Service
guest list). Most Alaska solicitations are on Online Public Notices (aws.state.ak.us/OnlinePublicNotices), which we do
not cover. The feed request has been sent and we are waiting for a reply (send date and recipient: record them under "Replies received" or in `state-feed-requests.local.md`).

**Why Public Notices is not covered.** The page loads, but its search and paging requests are answered with a DataDome
bot-protection challenge. We do not bypass bot protection. The GET-only browse pages give just the first 25 of about 58
rows, with meetings mixed in and no agency, so we do not use them.

**Why the IRIS adapter is fragile.** Same as Colorado: it replays IRIS's internal, undocumented guest calls. If CGI changes
them, Alaska shows as **failed** in the status (never silently wrong).

**What we are asking for.** The same template above, for any of: an RSS feed, API or CSV/JSON download of the procurement
category (Procurement is category 8 on the notices site); an email digest to a single mailbox; or written permission to
read the public list once a day. Also mention that we read the IRIS guest page automatically at low volume. The notices
site also has a Subscribe button; check whether it can feed the email reader.

**Where it went.** Recipient not recorded here. Keep the sender's details and the recipient in
`state-feed-requests.local.md` (not this public file). If there is no reply, the Online Public Notices site and the State of
Alaska Division of General Services procurement office are the places to follow up.

**If a reply arrives:** record it under "Replies received", then add the official feed to `alaska.js`; keep the IRIS
read unless they object, in which case delete `states/alaska.js` and its entry in `fetch-states.js`.

## Connecticut (CTsource) - sent, reply pending

Why: portal.ct.gov/DAS/CTSource/BidBoard is only a landing page with no bid list. The bids are inside the CTsource
portal behind a login, and biznet.ct.gov answers automated requests with a bot-filter rejection, so we do not read it.
(The `/search-results/` rule in portal.ct.gov/robots.txt is the portal's own site search and is unrelated.)

To: DAS.CTsource@ct.gov (Department of Administrative Services, Procurement Division, 860-713-5095; verified on
portal.ct.gov/das/ctsource/ctsource-resources/contact on 2026-11-11). Account problems only: SupplierSupport@ProactisServiceDesk.com.

Subject: Request for a data feed of open solicitations (CTsource Bid Board)

Hello,

I work at [company], a [small business] that bids on state contracts. We keep a small internal tracker of open
solicitations so we do not miss ones that fit our work.

We found that the CTsource Bid Board page on portal.ct.gov does not list solicitations publicly, and that the bid
system does not accept automated reads. So we would like to ask the supported way to get current open solicitations.
Does CTsource offer any of the following?
1. an RSS feed, API, or data download (CSV/JSON) of current open solicitations, or
2. an email digest we can subscribe to with a single mailbox, or
3. permission to read the public solicitation list automatically, once a day, at low volume.

If any of these exist, could you point me to the documentation or terms? If none do, could you tell me the
preferred way to get notified of new solicitations? We would only use the data to track bids for our own company
and would link back to CTsource for every solicitation.

Thank you,
[Name], [title], [company], [phone], [email]

- **New Hampshire (DAS Purchasing, Division of Procurement and Support Services), 2026-11-12:** "The State of New Hampshire does not allow any Third Party hosting of any bids, contracts or any other documents." Refused. NH is permanently excluded from the tracker; no feed, no scraping. Vendor resources: das.nh.gov/purchasing/vendorresources.aspx.
- **Minnesota (Office of State Procurement, Customer Service), 2026-11-12:** No feed offered. Reply: solicitations are posted by the state and it is the vendor's job to watch them; the vendor guide is mn.gov/admin/osp/vendors. Registering in the SWIFT Supplier Portal (a Bidder ID is issued immediately) and choosing category codes under Manage Profile > My Categorizations is the state's way to be matched to solicitations. Not yet known whether that sends email alerts. If it does, they could be read by the Gmail IMAP reader. Registration is an account the owner would have to create; no automatic source exists until then. Vendor Assistance: 651-201-8100, option 1, option 1.
