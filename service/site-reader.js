// Reads a vendor's public website so the setup wizard's helper bot can suggest categories.
// The URL is typed by a user, so this is an SSRF surface: only http(s) on ports 80/443, only hosts that resolve to
// PUBLIC addresses (checked on every redirect hop, and the connection is pinned to the checked address so a DNS
// change in between cannot redirect it), small size cap, short timeout. Page text is returned as DATA only.
const dns = require("dns").promises;
const net = require("net");
const http = require("http");
const https = require("https");

const MAX_BYTES = 600 * 1024, TIMEOUT_MS = 8000, MAX_HOPS = 4, MAX_PAGES = 3, MAX_TEXT = 9000;
let busy = 0;

function privateIp(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::" || /^f[cd]/.test(l) || /^fe[89ab]/.test(l)) return true;
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}

function normalize(input) {
  let s = String(input || "").trim();
  if (!s || s.length > 300) throw new Error("Enter a website address, for example example.com");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  let u; try { u = new URL(s); } catch { throw new Error("That does not look like a website address"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http and https addresses are supported");
  if (u.username || u.password) throw new Error("Addresses with a login are not supported");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Only standard web ports are supported");
  if (!u.hostname.includes(".") && !net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) throw new Error("That does not look like a website address");
  return u;
}

async function safeAddress(host) {
  host = host.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) { if (privateIp(host)) throw new Error("That address is not a public website"); return { address: host, family: net.isIP(host) }; }
  let list; try { list = await dns.lookup(host, { all: true }); } catch { throw new Error("Could not find that website"); }
  if (!list.length || list.some((x) => privateIp(x.address))) throw new Error("That address is not a public website");
  return list[0];
}

// One GET, no automatic redirects. Resolves { status, headers, body } (body capped).
function get(u, addr) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: u.hostname.replace(/^\[|\]$/g, ""), port: u.port || undefined, path: u.pathname + u.search, method: "GET", timeout: TIMEOUT_MS,
      headers: { "User-Agent": "RFQ-Setup-Helper/1.0", Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
      lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: addr.address, family: addr.family }]) : cb(null, addr.address, addr.family)), // pin to the vetted address
    }, (res) => {
      const chunks = []; let n = 0;
      res.on("data", (c) => { n += c.length; if (n > MAX_BYTES) { req.destroy(); resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }); } else chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("The website took too long to answer")));
    req.on("error", () => reject(new Error("Could not read that website")));
    req.end();
  });
}

async function fetchPage(u) {
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const addr = await safeAddress(u.hostname);
    const r = await get(u, addr);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      let next; try { next = normalize(new URL(r.headers.location, u).href); } catch (e) { throw new Error("The website redirected somewhere unsupported"); }
      u = next; continue;
    }
    if (r.status >= 400) throw new Error("The website answered with an error (" + r.status + ")");
    if (!/html|xml|text/i.test(String(r.headers["content-type"] || "text/html"))) throw new Error("That address is not a web page");
    return { url: u, html: r.body };
  }
  throw new Error("The website redirected too many times");
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const c = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 0 && c < 0x10ffff ? String.fromCodePoint(c) : " "; }
  return ENT[e.toLowerCase()] || " ";
});
function textOf(html) {
  return decode(html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function meta(html, name) {
  const m = new RegExp("<meta[^>]+(?:name|property)=[\"']" + name + "[\"'][^>]*>", "i").exec(html);
  const c = m && /content=["']([^"']*)["']/i.exec(m[0]);
  return c ? decode(c[1]).trim() : "";
}
function links(html, base) {
  const out = [], seen = {};
  const re = /<a\s[^>]*href=["']([^"'#]+)["']/gi; let m;
  while ((m = re.exec(html)) && out.length < 3) {
    let l; try { l = new URL(m[1], base); } catch { continue; }
    if (l.hostname !== base.hostname || !/\/(products?|shop|store|catalog|categories|services|solutions|about)/i.test(l.pathname) || seen[l.pathname]) continue;
    seen[l.pathname] = 1; out.push(l);
  }
  return out;
}

// Returns { site, title, description, text }. Throws Error with a message that is safe to show the user.
async function readSite(input) {
  if (busy >= 3) throw new Error("Busy, try again in a moment");
  busy++;
  try {
    const first = await fetchPage(normalize(input));
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(first.html) || [])[1];
    const parts = [meta(first.html, "description"), meta(first.html, "og:description"), meta(first.html, "keywords"), textOf(first.html)];
    for (const l of links(first.html, first.url).slice(0, MAX_PAGES - 1)) {
      try { parts.push(textOf((await fetchPage(l)).html).slice(0, 3000)); } catch (e) { /* extra pages are optional */ }
    }
    const text = parts.filter(Boolean).join(" \n ").slice(0, MAX_TEXT);
    if (text.length < 40) throw new Error("Could not find readable text on that website (it may need JavaScript)");
    return { site: first.url.origin, title: title ? decode(title).replace(/\s+/g, " ").trim() : "", description: meta(first.html, "description"), text };
  } finally { busy--; }
}

module.exports = { readSite, privateIp, normalize };
