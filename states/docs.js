// Fetches the text and PDF attachments of one state solicitation page, for the AI read (ai-extract.js).
// Only https, only the notice's own host, size-capped. Nothing fetched here is trusted: it goes to the model as data.
const { http } = require("./common");

const MAX_PAGE = 2e6, MAX_PDF = 8e6, MAX_PDFS = 2;

const sameHost = (a, b) => { try { return new URL(a).host === new URL(b).host; } catch { return false; } };

async function body(url, max) {
  const res = await http(url, { timeoutMs: 30000 }, 2);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > max) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > max ? null : { buf, type: res.headers.get("content-type") || "" };
}

// Likely attachment links: .pdf hrefs, or links whose text/path says download/attachment/solicitation/RFQ/RFP/ITB.
function attachmentLinks(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]*>/g, " ");
    if (!(/\.pdf(\?|$)/i.test(m[1]) || /(download|attachment|document)/i.test(m[1]) || /\b(rf[pq]|itb|ifb|solicitation|specification|scope of work|bid document)/i.test(label))) continue;
    let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base).href; } catch { continue; }
    if (/^https:/.test(u) && sameHost(u, base) && !out.includes(u)) out.push(u);
  }
  return out;
}

// -> { text: "page text", pdfs: [Buffer] } or null when the page could not be read.
async function readNotice(url) {
  const page = await body(url, MAX_PAGE);
  if (!page) return null;
  const pdfs = [];
  if (/pdf/i.test(page.type) || page.buf.slice(0, 4).toString() === "%PDF") return { text: "", pdfs: [page.buf] };
  const html = page.buf.toString("utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  for (const u of attachmentLinks(html, url).slice(0, 6)) {
    if (pdfs.length >= MAX_PDFS) break;
    try {
      const f = await body(u, MAX_PDF);
      if (f && f.buf.slice(0, 4).toString() === "%PDF") pdfs.push(f.buf);
    } catch { /* an unreadable attachment is not fatal */ }
  }
  return { text, pdfs };
}

module.exports = { readNotice, attachmentLinks };
