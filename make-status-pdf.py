# Regenerates state-fetch-status.pdf: python make-status-pdf.py state-fetch-status.pdf (needs reportlab). Edit the lists below, then rerun.
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

W=[("DE","Open-data API. 39 open."),("IN","HTML table. 54 open. Links go to the listing page."),
("IA","JSON endpoint. 47 open."),("LA","One HTML page per category. 139 open; takes about 100 s. Links go to the solicitation PDF."),
("MS","Table loaded by a form POST. 76 open."),("SC","Form POST plus session. 132 open."),
("ID","WordPress JSON. 10 open; many close dates are only anticipated."),("VT","Bid listing page. 9 open; links go to PDFs."),
("NV","Periscope portal. 29 open. Document pages are an AWS bot check, so attachments stay unread; we do not work around it."),
("NJ","Periscope portal. 22 open."),("OR","Periscope portal. 176 open; includes county and city bids, all tagged State. Document reads paced one every 5 s."),
("IL","Periscope portal. 162 open. Document reads paced one every 5 s."),
("MA","Periscope portal. 875 open at the last run. Slow (about 10 s a page). Earlier runs had one page (rows 725-749) blocked by the local network content filter. Document reads paced one every 5 s."),
("NY","NYS Contract Reporter: public listing (GET form), 736 open of 886 listed; sole-source, surplus, grant and RFI ads left out. Ad pages need a login behind reCAPTCHA, which we do not work around, so no document reads and no deadline times. Site terms require written permission to copy protected material; none requested."),
("RI","Form POST (ASP.NET). 30 open. Partial: covers quasi-state agencies, cities and towns, schools, colleges and grants only; executive-branch state bids are in a login system and are not covered."),
("WY","Public Purchase (the Google Sites page only points to it). 12 open. The listing is scrambled with decoy text; we read it the way a browser does, by dropping the spans the page itself hides. One request per run."),
("TX","Automatic source only: TxDOT open-data dataset, 329 open. Texas replied: no feed, and automated page reads are not offered, so the other agencies stay off. The hand-exported CSV route was removed.")]
ASK=[("PA","Replied: the free DGS e-Alert emails are the only route. Built: an automatic Gmail IMAP reader. Waiting on the Google app password (PA_GMAIL_USER, PA_GMAIL_APP_PASSWORD), so 0 notices so far. robots.txt forbids automated access to the site."),
("UT","robots.txt forbids all automated access (Bonfire). Email sent; reply pending."),
("OH","robots.txt forbids automated access, and the site is behind a login. Email sent; reply pending."),
("AL","robots.txt forbids all automated access. Email sent; reply pending."),
("CA","HTTP 403 to automated requests. Email sent; reply pending."),("CO","HTTP 403 to automated requests. Email sent; reply pending."),
("NH","HTTP 403 to automated requests. Email sent; reply pending."),("TN","HTTP 403 to automated requests. Email sent; reply pending."),
("ME","HTTP 403, and login-only since October 2025. Email sent; reply pending."),("MN","Bot challenge. Email sent; reply pending.")]
P=[("OK","The public list only holds old items: 153 of 155 rows are Pending Award; the 2 open ones closed in 2020 and 2021."),
("MO","Bids moved to the new MOVERS system, which needs a login."),
("CT","ASP.NET form pages; needs form-post work for few notices."),("AK","ASP.NET form pages or other system; needs form-post work for few notices."),
("HI","ASP.NET form pages or other system; needs form-post work for few notices."),("ND","ASP.NET form pages or other system; needs form-post work for few notices."),
("FL","The old Vendor Bid System is archival only (ads posted before 28 March 2022). Current bids are in MyFloridaMarketPlace (JavaScript app, vendor login); no feed or open data found."),
("VA","eVA Open Data Portal and data.virginia.gov hold historical procurement data only (yearly files, login to download), not open solicitations. No feed found."),
("AR","ARBuy shows 0 open bids while the state moves to Ariba in 2026. Recheck in a few months."),
("WV","Public pages are Bids Received results (no title or deadline), so they list closed solicitations. Open bids are in wvOASIS, a login-free but JavaScript session app (no plain listing) that often returns 503, so it is not built yet.")]
L=[("AZ","The public list is browsable, but app.az.gov robots.txt forbids all automated access, so no headless browser. Needs a feed request; none sent yet."),("NC","Dynamics portal, read-only offline shell."),("WA","JavaScript app."),
("KY","Advantage VSS system."),("MI","Advantage VSS system."),("KS","Public bid page (PeopleSoft, no robots.txt) loads, but the grid is empty until a stateful search POST; not built, site terms not reviewed."),("GA","Browser check."),
("MT","Public events are on the Jaggaer host bids.sciquest.com, whose robots.txt forbids all automated access. Needs a feed request; none sent yet."),("NM","Bonfire or Jaggaer system."),("SD","ESM system."),("WI","Public list needs no login but is a Blazor Server app (live websocket, no plain HTML or JSON). Not built."),("NE","The page came back empty.")]
U=[("MD","Open data was last updated in 2019.")]
groups=[("Working",W),("Asked for a feed",ASK),("Parked",P),("Login or JavaScript",L),("Unusable",U)]
assert sum(len(g) for _,g in groups)==50

ss=getSampleStyleSheet()
h1=ss["Title"]; h1.alignment=0
b=ParagraphStyle("b",parent=ss["BodyText"],fontSize=9.5,leading=12.5)
c=ParagraphStyle("c",parent=b,fontSize=9,leading=11.5)
doc=SimpleDocTemplate(sys.argv[1],pagesize=letter,leftMargin=45,rightMargin=45,topMargin=45,bottomMargin=45,title="State RFQ feeds: status of all 50 states")
el=[Paragraph("State RFQ feeds: status of all 50 states",h1),
Paragraph("Updated 2026-11-10 (evening) from state-sources-survey.md and the latest fetch run. Counts are open notices at that run.",b),Spacer(1,8),
Paragraph("Summary",ss["Heading2"])]
rows=[["Status","Count","States"]]+[[n,str(len(g)),", ".join(s for s,_ in g)] for n,g in groups]
def tbl(data,widths):
    data=[[Paragraph(str(x),c) for x in r] for r in data]
    t=Table(data,colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e6e9ef")),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#b8bec9")),("VALIGN",(0,0),(-1,-1),"TOP")]))
    return t
el+=[tbl(rows,[110,40,362]),Spacer(1,8),
Paragraph("Working states hold about 2,865 open notices (MA 875, NY 736, TxDOT 329, OR 176, IL 162, LA 139, SC 132, the rest under 80 each). Pennsylvania adds more once the Gmail app password is set. The app takes only automatic sources: no hand-exported files. Realistic free coverage is about 14 to 20 states unless feeds come back from the emails.",b),
Spacer(1,6),Paragraph("Every state",ss["Heading2"])]
rows=[["State","Status","Notes"]]
for n,g in groups:
    for s,t in g: rows.append([s,n,t])
el.append(tbl(rows,[40,100,372]))
doc.build(el)
