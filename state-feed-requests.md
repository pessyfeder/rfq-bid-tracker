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
| Alabama | Alabama Buys | Alabamabuys@purchasing.alabama.gov, (334) 353-0700 | Not verified: the state's pages showed no contact address when fetched; it came from search results. Phone is safest. |

## Also worth asking (blocked to automated requests, not forbidden)
California (Cal eProcure), Colorado, Maine, New Hampshire, Tennessee, Minnesota returned errors or bot challenges.
The same template works; for these, ask for permission or a feed rather than a way around the block.

## Replies received (2026-11-10)
- **Texas (SPD, Comptroller):** no data feed from ESBD. Search results can be exported as CSV from the site (limit 20,000 rows). Posted solicitations can be listed on SmartBuy: Vendor > ESBD Bid Opportunities > Status = Posted (filter by start/end date). The CSV export is manual, so it is not used (policy: only automatic sources). TxDOT notices are read automatically from Texas open data instead.
- **Pennsylvania (DGS Supplier Services):** the only notification route is eAlerts (email of open solicitations). Sign-up instructions are on the Supplier Service Center page; the e-Alerts login is dgs.internet.state.pa.us/EAlerts_V2/Login.aspx, with an "E-Alerts Guide" PDF. Bidding help: srmhelp@pa.gov.

## Maryland (eMMA) - draft, not yet sent

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
