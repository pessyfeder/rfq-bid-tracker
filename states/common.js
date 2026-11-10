// Shared helpers for the State-portal adapters (see fetch-states.js).
// An adapter is { code, name, fetch() } where fetch() resolves to an array of "raw notices":
//   { id, title, agency, category, posted: "YYYY-MM-DD"|null, due: "YYYY-MM-DD", dueTime: "3:00 PM ET"|null,
//     url (https), description, region }
const UA = "rfq-bid-tracker/1.0 (public procurement notices; polite, low-volume)";

async function http(url, opts = {}, tries = 2) {
  const { timeoutMs = 30000, ...fetchOpts } = opts;
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...fetchOpts, headers: { "User-Agent": UA, ...(fetchOpts.headers || {}) }, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
      return res;
    } catch (e) { last = e; await sleep(1500); }
  }
  throw last;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodeEntities = (s) => String(s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const clean = (s) => decodeEntities(String(s || "").replace(/<[^>]*>/g, " ")).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();

// Wall-clock time in a named zone -> { due: "YYYY-MM-DD", dueTime: "h:mm AM ET" } in Eastern time,
// because the feed treats published times as Eastern (service/feed.js dueInstant).
function wallClock(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"
  }).formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}
function toEastern(y, mo, d, h, mi, tz) {
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let guess = want;
  for (let i = 0; i < 2; i++) guess += want - wallClock(guess, tz); // converge on the zone's DST offset
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit"
  }).formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const h24 = Number(p.hour), h12 = h24 % 12 || 12;
  return { due: `${p.year}-${p.month}-${p.day}`, dueTime: `${h12}:${p.minute} ${h24 >= 12 ? "PM" : "AM"} ET` };
}

module.exports = { http, sleep, clean, decodeEntities, toEastern };
