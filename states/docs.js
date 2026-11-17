// Fetches the text and attachments of one state solicitation, for the AI read (ai-extract.js).
// Attachments can be PDFs (sent to the model as-is), Word .docx files (turned into text here) or a .zip of those.
// Only https, only the notice's own host, size-capped. Nothing fetched here is trusted: it goes to the model as data.
const { http, sleep } = require("./common");
const zip = require("./zip");

const MAX_PAGE = 2e6, MAX_FILE = 8e6, MAX_PDFS = 2, MAX_DOCX = 3, MAX_FETCH = 6, MAX_DOCX_TEXT = 40000;

// A portal's attachments sometimes live on its own document server: Mississippi's notice pages (ms.gov) link to SRM.MAGIC.MS.GOV.
const PARTNER_HOSTS = { "www.ms.gov": ["srm.magic.ms.gov"] };
const sameHost = (a, b) => {
  try {
    const x = new URL(a), y = new URL(b);
    return x.host === y.host || (PARTNER_HOSTS[y.host] || []).includes(x.hostname.toLowerCase());
  } catch { return false; }
};

// Boilerplate attachments that never say who may bid; tried last.
const SKIP = /terms (and|&) conditions|standard terms|forms? packet|price|pricing|cost (sheet|proposal)|pre-?quote|\bw-?9\b|insurance|affidavit|certification|questionnaire|amendment|public records request/i;
const WANTED = /rf[pqi]|itb|ifb|solicitation|specification|scope of work|bid document|invitation/i;

async function body(url, max) {
  const res = await http(url, { timeoutMs: 30000 }, 2);
  // A WAF bot check answers HTTP 202 with an empty body (Nevada). It is a deliberate refusal of automated reads: not worked around.
  if (res.headers.get("x-amzn-waf-action") === "challenge") throw new Error("BOTCHECK " + new URL(url).host);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > max) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) return null;
  const cookies = new Map();
  // Node 18 builds without getSetCookie(): headers.get() joins multiple Set-Cookie values with ", ".
  // Split only on commas that start a new "name=" pair so Expires dates ("Wed, 21 Oct") stay intact.
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") || "").split(/,(?=\s*[^;,=\s]+=)/).filter(Boolean);
  for (const c of setCookies) { const [kv] = c.split(";"); const i = kv.indexOf("="); cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
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

// Links to a shared folder on a file-sharing host (Box, Dropbox, Google Drive, OneDrive, SharePoint), whether a real link or plain
// text on the page. They are listed in "View Documents" but never downloaded (they need a browser).
const SHARE_HOST = /^https:\/\/([\w-]+\.)*(box\.com|dropbox\.com|drive\.google\.com|docs\.google\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com)\//i;
function sharedLinks(html) {
  const out = [];
  for (const m of html.replace(/&amp;/g, "&").matchAll(/https:\/\/[^\s<>"'()]+/gi)) {
    const u = m[0].replace(/[.,;:]+$/, "");
    if (SHARE_HOST.test(u) && !out.some((x) => x.url === u)) out.push({ url: u, label: "Shared folder" });
  }
  return out;
}

// Names a document by what it is, from its link text and file name. Shown in the "View Documents" column.
function docType(label, url) {
  let file = ""; try { file = decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch { /* keep empty */ }
  const t = label + " " + file;
  if (/addend|amendment/i.test(t)) return "Addendum";
  if (/rfq|request for quot/i.test(t)) return "RFQ";
  if (/rfp|request for proposal/i.test(t)) return "RFP";
  if (/itb|ifb|invitation (to|for) bid/i.test(t)) return "Bid Invitation";
  if (/specification|scope of work|sow/i.test(t)) return "Specifications";
  if (/terms (and|&) conditions|standard terms/i.test(t)) return "Terms & Conditions";
  if (/price|pricing|cost|bid form|quote form/i.test(t)) return "Pricing Form";
  if (/drawing|plan|plans/i.test(t)) return "Drawings";
  return "Project Document";
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

// The Indiana portal answers HTTP 403 to bursts of downloads. So: one download at a time (the caller reads three notices
// in parallel, so the spacing is enforced here, not by the caller), a generous gap between them, a slow retry when refused
// (honouring Retry-After), and a stop for the rest of the run after repeated refusals, so a block is never hammered.
// The refusal is thrown as "HTTP 403", which the caller reports as "refused by the portal" and keeps the row as not read.
const IN_GAP_MS = 2500, IN_RETRY_MS = [8000, 30000], IN_GIVE_UP_AFTER = 4;
let inQueue = Promise.resolve(), inRefusedInARow = 0;
function indianaZip(zipUrl) {
  const run = async () => {
    if (inRefusedInARow >= IN_GIVE_UP_AFTER) throw new Error("HTTP 403 for www.in.gov (stopped for this run after repeated refusals)");
    for (let attempt = 0; ; attempt++) {
      await sleep(IN_GAP_MS);
      let res;
      try { res = await fetch(zipUrl, { headers: { "User-Agent": "rfq-bid-tracker/1.0 (public procurement notices; polite, low-volume)" }, signal: AbortSignal.timeout(180000) }); } // some zips are 15+ MB
      catch (e) { if (attempt >= IN_RETRY_MS.length) throw e; continue; }
      if (res.ok) {
        inRefusedInARow = 0;
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length > 30e6 ? null : { buf };
      }
      if (res.status !== 403 && res.status !== 429 && res.status !== 503) throw new Error(`HTTP ${res.status} for www.in.gov`);
      if (attempt >= IN_RETRY_MS.length) { inRefusedInARow++; throw new Error(`HTTP ${res.status} for www.in.gov`); }
      const ra = Number(res.headers.get("retry-after")) * 1000;
      await sleep(Math.min(Math.max(ra || 0, IN_RETRY_MS[attempt]), 60000));
    }
  };
  const p = inQueue.then(run, run);
  inQueue = p.catch(() => {});
  return p;
}

// -> { text: "page text", pdfs: [Buffer] } or null when nothing could be read.
async function readNotice(url, r) {
  const got = { pdfs: [], docs: [] };

  // Indiana's notice URL is the page listing every event, so the notice's own documents are its per-event zip.
  if (r && /^IN-/.test(r.id)) {
    const zipUrl = "https://www.in.gov/idoa/proc/solicitations/files/" + encodeURIComponent(r.id.slice(3)) + ".zip";
    const f = await indianaZip(zipUrl);
    if (f) absorb(f.buf, "zip", got);
    // A missing zip comes back as the portal's HTML "not found" page: the agency posted no documents for this event.
    if (f && !zip.isZip(f.buf) && r.details) r.details.readNote = "The Indiana portal has no documents posted for this notice, so there is nothing to read beyond the listing. Check the agency's contact.";
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
  // Directly linkable attachments (not the Periscope javascript ones), named by type, for the "View Documents" column.
  const docs = attachmentLinks(html, url).filter((l) => /\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(l.url) || /(download|attachment)/i.test(l.url))
    .slice(0, 12).map((l) => ({ type: docType(l.label, l.url), name: l.label.slice(0, 120), url: l.url }));
  for (const l of sharedLinks(text)) if (docs.length < 14 && !docs.some((d) => d.url === l.url)) docs.push({ type: "Project Documents", name: l.url, url: l.url });
  return { text: got.docs.join("\n\n") + "\n\n" + text, pdfs: got.pdfs, docs };
}

module.exports = { readNotice, attachmentLinks };
