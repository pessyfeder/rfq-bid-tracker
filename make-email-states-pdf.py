# Regenerates email-alert-states.pdf: python make-email-states-pdf.py email-alert-states.pdf (needs reportlab).
# States where the only compliant automatic route found is the state's own vendor email alerts (the PA route).
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

# (state, priority, portal, how alerts work, state help contact, notes)
S=[
("AZ","1","Arizona Procurement Portal (spo.az.gov, app.az.gov)","Register as a supplier, choose commodity codes; email notices of matching solicitations.","State Procurement Office; third-party guide lists 602-542-7600 (verify).","robots.txt on app.az.gov forbids all automated access, so email is the only compliant route. The public list is browsable but must not be scraped."),
("MT","1","eMACS (spb.mt.gov/emacs-resources)","Vendor registration (basic profile 1) adds you to the vendor list; notices by commodity code or direct invitation.","emacs@mt.gov","Public events sit on bids.sciquest.com, whose robots.txt forbids all automated access. Email is the only compliant route."),
("WA","2","WEBS (pr-webs-vendor.des.wa.gov; des.wa.gov/bids)","Free registration with business name and tax ID; pick commodity codes; email when a matching bid posts.","webscustomerservice@des.wa.gov, 360-902-7400","DES says email can be lost to spam filters or missing codes; add webscustomerservice@des.wa.gov to safe senders. Not every Washington public agency posts in WEBS."),
("MI","2","SIGMA VSS (michigan.gov/sigmavss)","Free account; commodity codes and email in the SIGMA VSS profile are the only way to be notified of state bids. A separate MI Contract Connect email list also exists.","SIGMA-Vendor@Michigan.gov, 517-284-0540","Also has a Vendor Opportunity Dashboard (active and planned projects) and a downloadable contract list (existing contracts, not open bids)."),
("KY","2","Kentucky Vendor Self Service (vss.ky.gov)","VSS can send email notifications of relevant opportunities to registered vendors.","emars.vendors@ky.gov","Notification setup details not confirmed in the search; check the VSS registration guide."),
("NC","2","eVP (eprocurement.nc.gov/Vendor.html)","Register in eVP with commodity codes; one consolidated nightly email from vendor@nc.gov for matching solicitations posted or updated that day.","ephelpdesk@its.nc.gov","NC is migrating eVP, IPS and NC BIDS to a new system; go-live date and new notification features not confirmed. Recheck before subscribing."),
("WI","2","VendorNet / eSupplier (doa.wi.gov)","Register in eSupplier and choose NIGP codes; automatic email when the State, UW System or a municipality posts a match.","doawispro@wisconsin.gov, 608-264-7897","The public list needs no login but is a Blazor app (not scrapable by plain request)."),
("GA","3","Georgia Procurement Registry (doas.ga.gov, GPR FAQs)","The GPR FAQ lists how suppliers receive email notifications of posted notices; steps not seen in the search.","Georgia DOAS (GPR FAQ page)","The site shows a browser check, so email is the likely route. Confirm the steps on the GPR FAQ page first."),
("VA","2","eVA (eva.virginia.gov; open bids on mvendor.cgieva.com VBO)","Register as an eVA supplier and choose NIGP codes; eVA emails solicitation notices for matching codes (confirm at sign-up). Add noreply@cgeva.com to safe senders.","eVA Customer Care, 1-866-289-7367 (web request form on get-help-customer-care.html)","The public bid list is behind an AWS bot challenge, so it is not scrapable; open data is purchase orders only. Also ask Customer Care whether a sanctioned feed or API exists."),
("RI","2","Ocean State Procures (ridop.ri.gov/ocean-state-procures-osp; Bid Board on webprocure.proactiscloud.com)","Register as an OSP vendor and choose UNSPSC codes under My Account; Proactis emails new solicitations for matching codes. Sender is oceanstateprocures@proactis.com (from a vendor guide; confirm at sign-up).","suppliersupport@proactisservicedesk.com; Division of Purchases 401-574-8100","Covers executive-branch state bids, which the existing RI adapter (quasi-state, towns, schools) does not. The Bid Board host presents a certificate that does not verify against its claimed DigiCert issuer, so it cannot be fetched safely; report this to Proactis support. ridop.ri.gov blocks scripted requests (403)."),
]

ss=getSampleStyleSheet()
h1=ss["Title"]; h1.alignment=0
b=ParagraphStyle("b",parent=ss["BodyText"],fontSize=9.5,leading=12.5)
c=ParagraphStyle("c",parent=b,fontSize=8.5,leading=10.8)
doc=SimpleDocTemplate(sys.argv[1],pagesize=letter,leftMargin=40,rightMargin=40,topMargin=45,bottomMargin=45,title="State RFQ feeds: email-alert route")
def tbl(data,widths):
    data=[[Paragraph(str(x),c) for x in r] for r in data]
    t=Table(data,colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e6e9ef")),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#b8bec9")),("VALIGN",(0,0),(-1,-1),"TOP")]))
    return t
el=[Paragraph("State RFQ feeds: states for the email-alert route",h1),
Paragraph("Prepared 2026-11-11. These ten states offer free vendor email alerts but no feed or open data for open bids that I could find. The plan is the Pennsylvania route: subscribe once, let the alerts arrive in the dedicated Gmail account, and have a reader parse them automatically. Findings come from web searches, not from the portals themselves, so each state's alert details are to be confirmed at sign-up.",b),Spacer(1,8),
Paragraph("States and sign-up details",ss["Heading2"])]
rows=[["State","Priority","Portal","How alerts work","State help","Notes"]]+[list(r) for r in S]
el.append(tbl(rows,[28,34,92,122,78,176]))
el+=[Spacer(1,8),Paragraph("Priority 1 = scraping is forbidden, email is the only compliant route. 2 = alerts confirmed. 3 = alerts mentioned, steps not confirmed.",c),
Paragraph("Before you start",ss["Heading2"]),
Paragraph("1. The Pennsylvania reader has not yet run on a real email (waiting on the Google app password, PA_GMAIL_USER and PA_GMAIL_APP_PASSWORD). Prove it on PA first, then add states.",b),
Paragraph("2. Use the same dedicated Gmail account, or forward to it, so one IMAP reader covers all states.",b),
Paragraph("3. Registration is manual and one-time per state (vendor account, business details, terms). Claude cannot create accounts or enter credentials for you.",b),
Paragraph("4. Choose commodity or NIGP codes broadly, since alerts are filtered by code. Expect a lot of mail.",b),
Paragraph("5. After the first real alert from each state, check what it contains (title, agency, due date, link). Some links may need a login, and some alerts may lack a due date, as PA's does. The parser per state depends on this.",b),
Paragraph("6. RI already has a partial adapter (quasi-state, towns, schools); this alert route adds the executive-branch state bids. States not on this list: FL (old Vendor Bid System is archival; no alert option found) is parked; KS and the rest are on the main status PDF.",b),
Paragraph("Per-state checklist",ss["Heading2"])]
chk=[["State","Registered","Codes chosen","First alert received","Alert has due date?","Parser built"]]+[[r[0],"","","","",""] for r in S]
el.append(tbl(chk,[40,80,90,100,110,100]))
doc.build(el)
