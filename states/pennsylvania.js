// Pennsylvania: eMarketplace forbids automated access (robots.txt), and DGS says its only notification route is the
// free "eAlert" email. So this adapter reads saved alert emails (.eml files) from imports/pa-alerts/ and never
// contacts pa.gov.
//
// The alert emails go to a dedicated Gmail account, which this adapter reads automatically over IMAP (read-only:
// nothing is marked read or deleted). Set PA_GMAIL_USER and PA_GMAIL_APP_PASSWORD (a Google "app password"; never put
// them in the repo). Only emails from RA-paealerts@pa.gov in the last 90 days are read. There is no manual route:
// until the login is set, PA is reported as "waiting for the Gmail login" and shows no notices.
//
// What an alert contains (seen 2026-11-10): subject "New Solicitation eAlert for <ID> - <title>", a body
// "<Agency> has posted the following Solicitation <ID> for <description>. on eMarketplace.", and a link
// https://www.emarketplace.state.pa.us/Solicitations.aspx?SID=<ID>. It has NO due date, so each notice gets a
// placeholder date (shown in the app as "See eMarketplace") and the link to its eMarketplace page.
const tls = require("tls");
const net = require("net");
const { clean } = require("./common");

const PLACEHOLDER_DUE = "2099-12-31"; // the app treats far-future dates as "no real due date"
const SEE_EMARKETPLACE = "See eMarketplace";

// ---- minimal .eml reader (headers, RFC 2047 words, quoted-printable, base64, multipart) -------------------------
function splitMessage(raw) {
  const m = /\r?\n\r?\n/.exec(raw);
  const head = m ? raw.slice(0, m.index) : raw, body = m ? raw.slice(m.index + m[0].length) : "";
  const headers = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) { const k = line.slice(0, i).toLowerCase(); if (!(k in headers)) headers[k] = line.slice(i + 1).trim(); }
  }
  return { headers, body };
}

function decodeWords(s) {
  return String(s || "").replace(/=\?([\w-]+)\?([bq])\?([^?]*)\?=/gi, (_, cs, enc, txt) => {
    try {
      const buf = enc.toLowerCase() === "b" ? Buffer.from(txt, "base64")
        : Buffer.from(txt.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (__, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
      return new TextDecoder(/utf-?8/i.test(cs) ? "utf-8" : "windows-1252").decode(buf);
    } catch { return txt; }
  }).replace(/\?=\s+=\?/g, "");
}

function decodeBody(body, encoding, charset) {
  let buf;
  const enc = String(encoding || "").toLowerCase();
  if (enc === "base64") buf = Buffer.from(body.replace(/\s+/g, ""), "base64");
  else if (enc === "quoted-printable") {
    const t = body.replace(/=\r?\n/g, "").replace(/=([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    buf = Buffer.from(t, "latin1");
  } else buf = Buffer.from(body, "utf8");
  try { return new TextDecoder(/utf-?8|us-ascii/i.test(charset || "utf-8") ? "utf-8" : "windows-1252").decode(buf); } catch { return buf.toString("utf8"); }
}

// -> { text, html } with the first text/plain and text/html parts found.
function parts(raw, out = { text: "", html: "" }) {
  const { headers, body } = splitMessage(raw);
  const type = (headers["content-type"] || "text/plain").toLowerCase();
  const boundary = /boundary="?([^";]+)"?/i.exec(headers["content-type"] || "");
  if (type.startsWith("multipart/") && boundary) {
    for (const seg of body.split("--" + boundary[1]).slice(1)) {
      if (/^--/.test(seg)) break;
      parts(seg.replace(/^\r?\n/, ""), out);
    }
  } else if (type.startsWith("text/")) {
    const charset = (/charset="?([\w-]+)"?/i.exec(headers["content-type"] || "") || [])[1];
    const txt = decodeBody(body, headers["content-transfer-encoding"], charset);
    if (type.startsWith("text/html")) { if (!out.html) out.html = txt; } else if (!out.text) out.text = txt;
  }
  return out;
}

const htmlToText = (h) => clean(String(h).replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|br|li|tr)>|<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")).trim();

// ---- one alert email -> raw notice ------------------------------------------------------------------------------
const ET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

function parseAlert(raw) {
  const { headers } = splitMessage(raw);
  const subject = clean(decodeWords(headers.subject));
  const m = /eAlert for\s+(.+?)\s+-\s+(.+)$/i.exec(subject) || /eAlert for\s+(\S.*)$/i.exec(subject);
  if (!m) return null; // not a solicitation alert
  const body = parts(raw);
  const html = body.html || "";
  const text = body.text ? clean(body.text) : htmlToText(html);

  // Solicitation ID: prefer the SID in the eMarketplace link, else the subject.
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((x) => x[1].replace(/&amp;/g, "&"))
    .concat(text.match(/https:\/\/www\.emarketplace\.state\.pa\.us\/[^\s"'<>)]+/g) || []);
  let id = m[1].trim(), url = null;
  for (const l of links) {
    const sid = /^https:\/\/www\.emarketplace\.state\.pa\.us\/Solicitations\.aspx\?(?:[^#]*&)?SID=([^&#]+)/i.exec(l);
    if (sid) { try { id = decodeURIComponent(sid[1]).trim() || id; } catch { /* keep subject id */ } url = "https://www.emarketplace.state.pa.us/Solicitations.aspx?SID=" + encodeURIComponent(id); break; }
  }
  if (!url) url = "https://www.emarketplace.state.pa.us/Solicitations.aspx?SID=" + encodeURIComponent(id); // same pattern as the real links

  const who = /^\s*(.+?)\s+has posted the following/i.exec(text);
  const what = /following\s+Solicitation\s+.+?\s+for\s+(.+?)\s+on eMarketplace/i.exec(text);
  const date = headers.date && !isNaN(Date.parse(headers.date)) ? ET.format(new Date(headers.date)) : null;
  return {
    id: id.replace(/[^A-Za-z0-9._-]+/g, "-"),
    title: m[2] ? clean(m[2]) : id,
    agency: who ? clean(who[1]) : "Pennsylvania agency",
    category: "No data",
    posted: date,
    due: PLACEHOLDER_DUE, dueTime: SEE_EMARKETPLACE, // the alert has no due date
    url,
    description: what ? clean(what[1]) : "",
    region: "Pennsylvania"
  };
}


// ---- read-only IMAP (just enough for Gmail): LOGIN, EXAMINE, UID SEARCH, UID FETCH BODY.PEEK[] -----------------
class Imap {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.n = 0; this.pending = null;
    sock.on("data", (d) => { this.buf = Buffer.concat([this.buf, d]); this.pump(); });
    sock.on("error", (e) => this.fail(e));
    sock.on("close", () => this.fail(new Error("IMAP connection closed")));
  }
  fail(e) { const p = this.pending; this.pending = null; if (p) { clearTimeout(p.timer); p.rej(e); } }
  // Parse server lines (with {n} literals) until the tagged completion line of the pending command.
  pump() {
    const p = this.pending; if (!p) return;
    for (;;) {
      let pos = 0, text = "", lits = [];
      for (;;) {
        const i = this.buf.indexOf("\r\n", pos); if (i < 0) return; // wait for more data
        text += this.buf.slice(pos, i).toString("latin1");
        const m = /\{(\d+)\}$/.exec(text);
        if (!m) { pos = i + 2; break; }
        const len = Number(m[1]);
        if (this.buf.length < i + 2 + len) return;
        lits.push(this.buf.slice(i + 2, i + 2 + len));
        text = text.slice(0, m.index); pos = i + 2 + len;
      }
      this.buf = this.buf.slice(pos);
      if (text.startsWith(p.tag + " ")) {
        this.pending = null; clearTimeout(p.timer);
        const st = /^\S+\s+(OK|NO|BAD)\b\s*(.*)$/i.exec(text);
        return st && st[1].toUpperCase() === "OK" ? p.res(p.lines) : p.rej(new Error(`IMAP ${st ? st[1] : "error"}: ${st ? st[2] : text}`));
      }
      p.lines.push({ text, lits });
    }
  }
  cmd(line, secret) {
    const tag = "A" + ++this.n;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => this.fail(new Error(`IMAP timeout waiting for: ${secret ? "(login)" : line}`)), 60000);
      this.pending = { tag, res, rej, lines: [], timer };
      this.pump(); // the server greeting may already be buffered
      this.sock.write(`${tag} ${line}\r\n`);
    });
  }
}

const q = (s) => JSON.stringify(String(s)); // IMAP quoted string: only \ and " are escaped, same as JSON for plain text
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const imapDate = (d) => `${String(d.getUTCDate()).padStart(2, "0")}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
const FROM = "RA-paealerts@pa.gov", DAYS = 90, FOLDERS = ["INBOX", "[Gmail]/Spam"];

// -> array of raw message strings. opts: { host, port, plain (tests only), user, pass, folders, now }
async function readMailbox(opts) {
  const sock = await new Promise((res, rej) => {
    const s = opts.plain ? net.connect(opts.port, opts.host, () => res(s)) : tls.connect({ host: opts.host, port: opts.port || 993, servername: opts.host }, () => res(s));
    s.once("error", rej);
  });
  const c = new Imap(sock), out = [];
  try {
    try { await c.cmd(`LOGIN ${q(opts.user)} ${q(opts.pass)}`, true); }
    catch (e) { throw new Error("Gmail login failed (check PA_GMAIL_USER, the app password, and that IMAP is on): " + e.message); }
    const since = imapDate(new Date((opts.now || Date.now()) - DAYS * 86400000));
    for (const folder of opts.folders || FOLDERS) {
      try { await c.cmd(`EXAMINE ${q(folder)}`); } catch { continue; } // read-only; a folder that does not exist is skipped
      const hits = (await c.cmd(`UID SEARCH FROM ${q(FROM)} SINCE ${since}`)).filter((l) => /^\* SEARCH/i.test(l.text));
      const uids = hits.flatMap((l) => l.text.replace(/^\* SEARCH\s*/i, "").split(/\s+/).filter(Boolean));
      for (let i = 0; i < uids.length; i += 40) {
        for (const l of await c.cmd(`UID FETCH ${uids.slice(i, i + 40).join(",")} (BODY.PEEK[])`)) if (l.lits[0]) out.push(l.lits[0].toString("utf8"));
      }
    }
    try { await c.cmd("LOGOUT"); } catch { /* server closes first */ }
  } finally { sock.destroy(); }
  return out;
}

async function readAll() {
  const user = process.env.PA_GMAIL_USER, pass = (process.env.PA_GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) throw new Error("Waiting for the Gmail login: set PA_GMAIL_USER and PA_GMAIL_APP_PASSWORD");
  const msgs = await readMailbox({ host: "imap.gmail.com", port: 993, user, pass });
  console.log(`  PA: ${msgs.length} alert email(s) read from the mailbox`);
  const byId = new Map(); let skipped = 0;
  for (const raw of msgs) { const n = parseAlert(raw); if (n) byId.set(n.id, n); else skipped++; } // later ones win for the same ID
  if (skipped) console.warn(`  PA: ${skipped} email(s) were not solicitation alerts and were skipped`);
  if (!byId.size) throw new Error("No solicitation alerts in the mailbox yet");
  return [...byId.values()];
}

module.exports = {
  code: "PA", name: "Pennsylvania",
  noPageReads: true, // robots.txt forbids automated reads of eMarketplace: the AI page read in fetch-states.js must not fetch these URLs
  noPageReadsWhy: "eMarketplace does not allow automated reads",
  noPageReadsNote: "Pennsylvania eMarketplace does not allow automated reads, so the due date and eligibility were not read. Open the notice on eMarketplace.",
  async fetch() { return readAll(); },
  parseAlert, readMailbox // exported for testing
};
