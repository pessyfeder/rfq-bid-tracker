# RFQ Bid Tracker: questions for Israel

The app shows each request with a status, a "Can we bid?" check, the deadline and the key requirements. To finish it with real data, we need your answers below. Short answers are fine.

## 1. About Discover Group

- [ ] **What lists, certifications and licences does Discover Group hold?**
  Examples: GSA Schedule, NASA SEWP, small business, MWBE, NY or NJ licences.
  *Why:* the "Can we bid?" column compares each request against this list. It currently uses made-up values.
  Answer: ______________________________

- [ ] **Which regions and categories do you serve?** Should requests outside them be hidden automatically?
  Answer: ______________________________

## 2. What the app should show

- [ ] **Bonds and mandatory pre-bid meetings:** should each get its own column, since they can decide bid or no-bid?
- [ ] **Extra details:** do you want contact person, how to submit, and contract length shown?
- [ ] **Notes and outcomes:** do you want a note per request (e.g. why you passed) and Won / Lost statuses?

## 3. Where it runs, and keeping it private

Your Interested / Bidding / Passed choices show which bids you're pursuing, so we should decide this on purpose.

- [ ] **Who will use it?** Just you, or several people with logins?
  *Why:* several users means choices must be saved centrally, not in one browser.
- [ ] **Where should it live?**
  - Your own computer or a private login: pipeline stays private, but it is only on that machine (or behind that login).
  - Your own server: full control, you maintain it. About $5 to $25 a month.
  - A hosted service such as Supabase: less upkeep, depends on another company. Free tier is limited; paid is about $25 a month.
  - A public website: not recommended, because anyone could see which bids you're pursuing.
  Answer: ______________________________

## 4. Needed to start

- [ ] **SAM.gov API key.** Free, from your SAM.gov account (Account Details). It stays in a protected setting on the computer, never in the app's files or on GitHub. Who will register for it: you or me?
  Answer: ______________________________

---
*The public bid data from SAM.gov carries no privacy risk. The main thing to protect is the key and your own pipeline.*
