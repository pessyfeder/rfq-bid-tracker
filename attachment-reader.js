// Shared attachment reading for the sources that do not already do it (SAM.gov = Federal, NYC City Record = Local).
// The state portals read their attachments in states/docs.js; this module reuses its file handling, so a PDF, a Word .docx
// or a .zip of those is treated the same way for every jurisdiction: PDFs go to the model as-is, .docx becomes text.
//
//   const got = newBag();                        // { pdfs: [Buffer], docs: [string] }
//   absorb(buffer, label, got);                  // adds what one downloaded file contributes
//   const att = asRead(got);                     // { text, pdfs } for notice-reader.readText, or null when nothing was read
//   const urls = linksInText(noticeText, ok);    // direct .pdf/.docx/.zip links written in a notice's text
//   const buf = await download(url, opts);       // https only, size-capped; null when too large
//
// Everything downloaded is untrusted data: it only ever goes to the model as a document to read.
const { absorb } = require("./states/docs");

const MAX_FILE = 8e6;                 // bytes per file; larger files are skipped, not truncated
const MAX_PDFS = 2, MAX_DOCX = 3;     // same limits as states/docs.js

const newBag = () => ({ pdfs: [], docs: [] });
const full = (got) => got.pdfs.length >= MAX_PDFS && got.docs.length >= MAX_DOCX;

// -> { text, pdfs } or null when no file contributed anything
function asRead(got) {
  if (!got.pdfs.length && !got.docs.length) return null;
  return { text: got.docs.join("\n\n"), pdfs: got.pdfs };
}

// https links in a notice's text that point straight at a document. `ok(url)` limits which hosts may be fetched.
function linksInText(text, ok) {
  const out = [];
  for (const m of String(text || "").replace(/&amp;/g, "&").matchAll(/https:\/\/[^\s<>"'()]+\.(?:pdf|docx|zip)(?![\w])[^\s<>"'()]*/gi)) {
    const u = m[0].replace(/[.,;:]+$/, "");
    if ((!ok || ok(u)) && !out.includes(u)) out.push(u);
  }
  return out;
}

// One download. `fetchFn` lets a caller route the request through its own quota counting (SAM.gov does).
async function download(url, { fetchFn = fetch, max = MAX_FILE } = {}) {
  if (!/^https:\/\//i.test(url)) return null;
  const res = await fetchFn(url, { redirect: "follow", signal: AbortSignal.timeout(60000), headers: { "User-Agent": "rfq-bid-tracker/1.0 (public procurement notices; polite, low-volume)" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  if (Number(res.headers.get("content-length") || 0) > max) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > max ? null : buf;
}

module.exports = { newBag, absorb, asRead, full, linksInText, download, MAX_FILE };
