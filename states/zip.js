// Minimal ZIP reader (no dependencies) for two jobs: Word .docx text, and the per-bid .zip of documents some portals offer.
// Everything read here is untrusted: output sizes are capped so a hostile archive cannot fill memory.
const zlib = require("zlib");

const MAX_ENTRY = 30e6; // largest single file we will inflate
const MAX_ENTRIES = 500;

const isZip = (buf) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5);

// -> [{ name, method, csize, usize, offset }] from the central directory, or [] if it is not a readable zip
function entries(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
  if (end < 0 || end + 22 > buf.length) return [];
  const n = Math.min(buf.readUInt16LE(end + 10), MAX_ENTRIES);
  let p = buf.readUInt32LE(end + 16);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    out.push({
      name: buf.slice(p + 46, p + 46 + nl).toString("utf8"),
      method: buf.readUInt16LE(p + 10), csize: buf.readUInt32LE(p + 20), usize: buf.readUInt32LE(p + 24),
      offset: buf.readUInt32LE(p + 42)
    });
    p += 46 + nl + el + cl;
  }
  return out;
}

// -> Buffer of the entry's contents, or null (too big, encrypted, unsupported method)
function read(buf, e) {
  if (e.usize > MAX_ENTRY || e.offset + 30 > buf.length || buf.readUInt32LE(e.offset) !== 0x04034b50) return null;
  const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
  const raw = buf.slice(start, start + e.csize);
  try {
    if (e.method === 0) return raw;
    if (e.method === 8) return zlib.inflateRawSync(raw, { maxOutputLength: MAX_ENTRY });
  } catch { /* corrupt or over the cap */ }
  return null;
}

// Word .docx -> plain text (paragraphs on their own lines), or null if the file is not a docx
function docxText(buf) {
  const e = entries(buf).find((x) => x.name === "word/document.xml");
  const xml = e && read(buf, e);
  if (!xml) return null;
  return xml.toString("utf8")
    .replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>|<w:br\/>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

module.exports = { isZip, entries, read, docxText };
