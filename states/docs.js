// Fetches the text and attachments of one state solicitation, for the AI read (ai-extract.js).
// Attachments can be PDFs (sent to the model as-is), Word .docx files (turned into text here) or a .zip of those.
// Only https, only the notice's own host, size-capped. Nothing fetched here is trusted: it goes to the model as data.
const { http, sleep } = require("./common");
const zip = require("./zip");

const MAX_PAGE = 2e6, MAX_FILE = 8e6, MAX_PDFS = 2, MAX_DOCX = 3, MAX_FETCH = 6, MAX_DOCX_TEXT = 40000;

const sameHost = (a, b) => { try { return new URL(a).host === new URL(b).host; } catch { return false; } };

// Boilerplate attachments that never say who may bid; tried last.
const SKIP = /terms (and|&) conditions|standard terms|forms? packet|price|pricing|cost (sheet|proposal)|pre-?quote|\bw-?9\b|insurance|affidavit|certification|questionnaire|amendment/i;
const WANTED = /rf[pqi]|itb|ifb|solicitation|specification|scope of work|bid document|invitation/i;

async function body(url, max) {
  const res = await http(url, { timeoutMs: 30000 }, 2);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > max) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) return null;
  const cookies = new Map();
  for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(";"); const i = kv.indexOf("="); cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
  return { buf, type: res.headers.get("content-type") || "", cookies };
}

// Likely attachment links: .pdf/.docx hrefs, or links whose text/path says download/attachment/solicitation/RFQ/RFP/ITB.
// -> [{ url, label }]
function attachmentLinks(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!(/\.(pdf|docx)(\?|$)/i.test(m[1]) || /(download|attachment|document)/i.test(m[1]) || WANTED.test(label))) continue;
    let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base).href; } catch { continue; }
    if (/^https:/.test(u) && sameHost(u, base) && !out.some((x) => x.url === u)) out.push({ url: u, label });
  }
  return out;
}

// Periscope portals (NV, NJ, OR, IL, MA) list attachments as javascript:downloadFile('id') and fetch them by posting the
// page's own hidden form back with mode=download. -> [{ label, get() }]
function periscopeFiles(html, url, cookies) {
  const form = /<form[^>]*name="bidDetail"[\s\S]*?<\/form>|<form[^>]*id="bidDetail"[\s\S]*?(?=<script)/i.exec(html);
  if (!form) return [];
  const fields = {};
  for (const m of form[0].matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
    const n = /name="([^"]*)"/.exec(m[0]), v = /value="([^"]*)"/.exec(m[0]);
    if (n) fields[n[1]] = v ? v[1] : "";
  }
  const origin = new URL(url).origin;
  const cookie = [...cookies].map(([k, v]) => k + "=" + v).join("; ");
  const out = [];
  for (const m of html.matchAll(/downloadFile\('(\d+)'\)[^>]*>([^<]*)/g)) {
    out.push({
      label: m[2].replace(/\s+/g, " ").trim(),
      async get() {
        await sleep(500); // low volume: one file at a time, half a second apart
        const res = await http(origin + "/bso/external/bidDetail.sda", { method: "POST", timeoutMs: 60000,
          body: new URLSearchParams({ ...fields, mode: "download", downloadFileNbr: m[1] }),
          headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie } }, 2);
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length > MAX_FILE ? null : buf;
      }
    });
  }
  return out;
}

// Sorts so likely solicitation documents come first and boilerplate last.
const rank = (label) => (SKIP.test(label) ? 2 : WANTED.test(label) ? 0 : 1);
const byRank = (a, b) => rank(a.label) - rank(b.label);
// Boilerplate (terms, forms, price sheets) is read only when a notice has nothing else.
const useful = (list) => (list.some((x) => rank(x.label) < 2) ? list.filter((x) => rank(x.label) < 2) : list);

// Takes what one fetched file contributes: a PDF, a docx's text, or (for a zip) the same from its members.
function absorb(buf, label, got, depth = 0) {
  if (!buf) return;
  if (buf.slice(0, 4).toString() === "%PDF") { if (got.pdfs.length < MAX_PDFS) got.pdfs.push(buf); return; }
  if (!zip.isZip(buf)) return;
  const text = zip.docxText(buf);
  if (text !== null) { if (got.docs.length < MAX_DOCX) got.docs.push(text.slice(0, MAX_DOCX_TEXT)); return; }
  if (depth > 0) return; // a zip inside a zip is not followed
  const members = zip.entries(buf).filter((e) => /\.(pdf|docx)$/i.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name))
    .map((e) => ({ e, label: e.name })).sort(byRank);
  const use = useful(members);
  for (const { e, label: l } of use) {
    if (got.pdfs.length >= MAX_PDFS && got.docs.length >= MAX_DOCX) break;
    absorb(zip.read(buf, e), l, got, depth + 1);
  }
}

// -> { text: "page text", pdfs: [Buffer] } or null when nothing could be read.
async function readNotice(url, r) {
  const got = { pdfs: [], docs: [] };

  // Indiana's notice URL is the page listing every event, so the notice's own documents are its per-event zip.
  if (r && /^IN-/.test(r.id)) {
    const zipUrl = "https://www.in.gov/idoa/proc/solicitations/files/" + encodeURIComponent(r.id.slice(3)) + ".zip";
    await sleep(400); // the portal answers HTTP 403 to bursts of downloads
    const f = await body(zipUrl, 30e6);
    if (f) absorb(f.buf, "zip", got);
    if (!got.pdfs.length && !got.docs.length) return null; // some zips are missing (the portal serves a "not found" page): not read
    return { text: got.docs.join("\n\n") + "\n\n" + (r.scope || r.title || ""), pdfs: got.pdfs };
  }

  const page = await body(url, MAX_PAGE);
  if (!page) return null;
  if (page.buf.slice(0, 4).toString() === "%PDF") return { text: "", pdfs: [page.buf] };
  const html = page.buf.toString("utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");

  let items = attachmentLinks(html, url).map((l) => ({ label: l.label, get: async () => (await body(l.url, MAX_FILE).catch(() => null) || {}).buf }))
    .concat(periscopeFiles(html, url, page.cookies));
  const todo = useful(items.sort(byRank)).slice(0, MAX_FETCH);
  for (const it of todo) {
    if (got.pdfs.length >= MAX_PDFS && got.docs.length >= MAX_DOCX) break;
    try { absorb(await it.get(), it.label, got); } catch { /* an unreadable attachment is not fatal */ }
  }
  // attachment text first: the model reads a limited amount, and the page itself is mostly navigation
  return { text: got.docs.join("\n\n") + "\n\n" + text, pdfs: got.pdfs };
}

module.exports = { readNotice, attachmentLinks };
