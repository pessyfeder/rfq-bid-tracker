State portals (about 17 minutes in):

Finished: DE, IN, IA, LA, MS, SC, ID, VT, NV and NJ.

Still to come: OR, IL and MA, per the source list.

So far it has made 180 AI calls and reused 203 from cache, costing $0.48 total.

I’ll report the final state totals when it finishes.

do that



"Details" column needs to show impt details as chips

Indiana: the portal returned HTTP 403 on many zip downloads, even with a delay between them. 39 rows are still “Not stated”, and some are probably blocked rather than silent.

Nevada: the 15 "empty" pages are an AWS WAF bot check (HTTP 202, empty body, x-amzn-waf-action: challenge). The portal refuses automated reads; we don't work around it. The fetch log now reports them as "refused by the portal's bot check". Rows stay "Not read" unless Nevada offers a permitted route (e.g. an official data feed or written permission).

Other “Not read” rows: SC has 72 that were never read, and they are untouched.

