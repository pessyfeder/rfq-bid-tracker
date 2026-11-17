// Who to contact about a solicitation. Shared by the Federal (SAM), State and Local (NYC) feeds.
// A contact is { name?, email?, phone? } or null. Structured fields from the source are preferred;
// fromText() is a free keyword pass (no AI cost) over the notice text for sources that have none.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
// Addresses that are never the buyer: portal help desks and no-reply senders.
const NOISE = /^(no-?reply|donotreply|do-not-reply)@|@(sam\.gov|gsa\.gov)$/i;
const ROLE = "Contracting Officer|Contract Specialist|Contract Officer|Procurement (?:Officer|Specialist|Analyst|Manager)|Purchasing (?:Agent|Officer|Manager)|Buyer|Purchasing Specialist";

const tidy = (s, max) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

function make(name, email, phone) {
  const c = {};
  const n = tidy(name, 80), e = tidy(email, 120), p = tidy(phone, 40);
  if (n) c.name = n;
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[A-Za-z]{2,}$/.test(e)) c.email = e;
  if (p && /\d{3}\D*\d{3}\D*\d{4}/.test(p)) c.phone = p;
  return c.name || c.email || c.phone ? c : null;
}

// Free text -> best contact found, or null. Emails are taken as written; first plausible phone and name.
function fromText(text) {
  const plain = String(text || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const emails = (plain.match(EMAIL) || []).filter((e) => !NOISE.test(e));
  if (!emails.length) return null;
  const email = emails[0];
  // Look for the phone and name close to the first address first, then anywhere.
  const at = plain.indexOf(email);
  const near = plain.slice(Math.max(0, at - 200), at + email.length + 200);
  const phone = (PHONE.exec(near) || PHONE.exec(plain) || [])[0] || "";
  const nm = new RegExp("([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][A-Za-z'’-]+)\\s*,?\\s*(?:\\(?" + ROLE + "\\)?)").exec(near)
    || new RegExp("(?:" + ROLE + ")\\s*[:,-]?\\s*([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][A-Za-z'’-]+)").exec(near)
    || /(?:Buyer|Contact|POC)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][A-Za-z'’-]+)/.exec(near);
  return make(nm ? nm[1] : "", email, phone);
}

// SAM.gov v2 search: pointOfContact is [{ type: "primary"|"secondary", fullName, email, phone, title }]
function fromSam(poc) {
  if (!Array.isArray(poc) || !poc.length) return null;
  const sorted = poc.slice().sort((a, b) => (a && a.type === "primary" ? 0 : 1) - (b && b.type === "primary" ? 0 : 1));
  for (const p of sorted) { const c = p && make(p.fullName, p.email, p.phone); if (c) return c; }
  return null;
}

module.exports = { make, fromText, fromSam };
