// The one place where an AI read of a notice is turned into record fields, for every jurisdiction
// (SAM.gov = Federal, NYC City Record = Local, the state portals = State).
//
// Each source has its own way of getting a notice's text (an API field, a portal page, PDF attachments). That part stays
// per source. Its only job is to hand over text (and PDFs, if any). From there the read and the way its result lands on
// the record (requires = eligibility, shall = chips, scope = description) are the same everywhere, so they live here.
//
//   const ai = await readText(text, key, pdfs);   // reads the text; null when it could not be read
//   applyRead(record, ai, options);               // writes it onto the record
//   await readInto(record, text, key, options);   // both steps in one call
const { extract, extractWithPdfs } = require("./ai-extract");

// Read one notice's text (plus PDF Buffers, if any). Returns { requires, scope, shall, naics, dueDate } or null.
function readText(text, key, pdfs) {
  return pdfs && pdfs.length ? extractWithPdfs(text, pdfs, key) : extract(text, key);
}

// Put a read result on the record. Returns true when something was applied.
// options.mergeRequires  keep restrictions already found by keyword on the record and add the AI's (SAM.gov does this)
// options.forceRequires  an unclear read (requires null) replaces the old value too (an amended notice's old restriction no longer applies)
// options.statedFields   also take NAICS and the document's own due date from the read (states take NAICS from a regex instead)
function applyRead(r, ai, options = {}) {
  if (!ai) return false;
  if (options.mergeRequires) {
    const base = r.requires || [];
    if (ai.requires !== null) r.requires = Array.from(new Set(base.concat(ai.requires)));
    else if (!base.length) r.requires = null;
  } else if (ai.requires !== null || options.forceRequires) r.requires = ai.requires;
  if (ai.scope) r.scope = ai.scope;
  if (ai.shall.length) r.shall = ai.shall;
  if (ai.terms && Object.values(ai.terms).some((a) => a.length)) r.terms = ai.terms; // requirement checklist lines (specs, deadlines, delivery, payment, certifications)
  if (options.statedFields) {
    if (ai.naics) r.naics = ai.naics;
    if (ai.dueDate) r.docDue = ai.dueDate;
  }
  r.aiRead = true;
  return true;
}

async function readInto(r, text, key, options = {}) {
  scanDocs(r, text, options.pdfs);
  return applyRead(r, await readText(text, key, options.pdfs), options);
}

// Scan the full text read for a notice (page text plus Word attachments) for bid factors and keep them on the record as
// docFacts; computeFacts (facts.js) merges them in. An empty scan leaves an earlier docFacts alone.
function scanDocs(r, text, pdfs) {
  const { pdfText } = require("./pdf-text");
  let all = String(text || "").slice(0, 200000);
  for (const b of pdfs || []) { try { all += "\n\n" + pdfText(b); } catch (e) { /* unreadable PDF: the model still reads it */ } }
  const f = require("./facts").scanText(all);
  if (f.length) r.docFacts = f;
  return f.length;
}

module.exports = { readText, applyRead, readInto, scanDocs };
