// RFQ Bid Tracker - standalone service.
//
// One process that (1) runs the fetchers (first start/wake each morning), (2) keeps the results in data/state.json,
// and (3) serves them as JSON to the other machine over HTTP. See FEED.md for the API and spec.txt
// for the rest. No npm dependencies; Node 18+.
//
//   node server.js            start the service
//   node server.js --once     run one refresh now, write data/feed.json, exit (no HTTP)

const fs = require("fs");
const path = require("path");
const http = require("http");
const zlib = require("zlib");
const crypto = require("crypto");
const vm = require("vm");
const { spawn } = require("child_process");
const { computeFacts } = require("./facts");
const feed = require("./service/feed");

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA, "state.json");
const SNAPSHOT_FILE = path.join(DATA, "feed.json");
const LOG_FILE = path.join(DATA, "service.log");

// ---- config: environment, with an optional git-ignored .env file for the same names -------------
// Called at startup and again at the start of every refresh, so edits to .env apply without a restart.
// A variable set in the real environment always wins; only names this function set itself are updated or removed.
const dotEnvKeys = new Set();
function loadDotEnv() {
  let text = "";
  try { text = fs.readFileSync(path.join(ROOT, ".env"), "utf8"); } catch { /* no .env: drop anything it set earlier */ }
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    if (process.env[m[1]] !== undefined && !dotEnvKeys.has(m[1])) continue; // real environment wins
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    dotEnvKeys.add(m[1]); seen.add(m[1]);
  }
  for (const k of [...dotEnvKeys]) if (!seen.has(k)) { delete process.env[k]; dotEnvKeys.delete(k); } // line removed from .env
}
loadDotEnv();

function morningHourFromEnv() { // an invalid hour makes every date comparison NaN, which silently stops all refreshes
  const raw = process.env.REFRESH_MORNING_HOUR, h = Number(raw || 5);
  if (Number.isInteger(h) && h >= 0 && h <= 23) return h;
  console.warn(`REFRESH_MORNING_HOUR="${raw}" is not an integer 0-23; using 5`);
  return 5;
}
const CFG = {
  host: process.env.HOST || "127.0.0.1",           // this machine only unless HOST is set (HOST=0.0.0.0 for all interfaces)
  port: Number(process.env.PORT || 8765),
  morningHour: morningHourFromEnv(),   // daily cycle starts at this local hour; one refresh per cycle
  wakeDelaySec: Number(process.env.WAKE_DELAY_SEC || 45),       // after a wake, wait for Wi-Fi/VPN before fetching
  fetchTimeoutMin: Number(process.env.FETCH_TIMEOUT_MIN || 45)
};
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const isLoopback =(h) => h === "127.0.0.1" || h === "::1" || h === "localhost";

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(line);
  try { fs.mkdirSync(DATA, { recursive: true }); fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
}
function rotateLog() { // keep the log from growing forever
  try { if (fs.statSync(LOG_FILE).size > 2e6) fs.renameSync(LOG_FILE, LOG_FILE + ".1"); } catch {}
}

// ---- state -------------------------------------------------------------------------------------
let state = feed.loadState(STATE_FILE);
state.runs = state.runs || {};            // per-source: last attempt / success / error
const refresh = { running: false, startedAt: null, child: null, progress: null, reason: null, only: null };
// progress (for the page's banner): which source is running (step of steps) and, for the states fetch, how many states are done.
// The states fetcher prints "@progress <done> <total> <CODE>" before each state.

function save() {
  feed.writeAtomic(STATE_FILE, JSON.stringify(state));
  feed.writeAtomic(SNAPSHOT_FILE, JSON.stringify(feed.query(state, new URLSearchParams("open=0"), { unlimited: true }), null, 1));
}

// ---- running the fetchers ------------------------------------------------------------------------
function killTree(child) { // a fetcher can start its own child processes; on Windows kill() alone would leave them running
  try {
    if (process.platform === "win32" && child.pid) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else child.kill();
  } catch (e) { try { child.kill(); } catch (_) {} }
}
// Fetchers also trust the operating system's certificate store (where a company/ISP web filter or antivirus installs the root
// it signs HTTPS with). Without it Node reports UNABLE_TO_VERIFY_LEAF_SIGNATURE on every request behind such a filter.
// Only added when this Node version knows the flag, since an unknown flag in NODE_OPTIONS would stop the fetcher starting.
function sysCaEnv() {
  const env = { ...process.env };
  if (process.allowedNodeEnvironmentFlags.has("--use-system-ca") && !/--use-system-ca/.test(env.NODE_OPTIONS || "")) env.NODE_OPTIONS = ((env.NODE_OPTIONS || "") + " --use-system-ca").trim();
  return env;
}
function runFetcher(src, args = []) {
  return new Promise((resolve) => {
    const missing = src.needsEnv.filter((k) => !process.env[k]);
    if (missing.length) return resolve({ ok: false, skipped: true, error: `${missing.join(", ")} not set` });
    const child = spawn(process.execPath, [src.script, ...args], { cwd: ROOT, env: sysCaEnv(), windowsHide: true });
    refresh.child = child;
    let out = "", partial = "";
    const keep = (b) => {
      out = (out + b).slice(-4000);
      const lines = (partial + b).split("\n"); partial = lines.pop();
      for (const l of lines) {
        const m = /^@progress (\d+) (\d+) (\S+)/.exec(l);
        if (m && refresh.progress) Object.assign(refresh.progress, { done: +m[1], total: +m[2], current: m[3] });
        const d = /^@done (\S+) (ok|fail)/.exec(l);
        if (d && refresh.progress) (refresh.progress[d[2] === "ok" ? "updated" : "failedNow"] ||= []).push(d[1]);
      }
    };
    child.stdout.on("data", keep); child.stderr.on("data", keep);
    const timer = setTimeout(() => { out += "\n[killed: timeout]"; killTree(child); }, CFG.fetchTimeoutMin * 60000);
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message }); });
    child.on("close", (code) => {
      clearTimeout(timer); refresh.child = null;
      resolve({ ok: code === 0, error: code === 0 ? null : (out.trim().split("\n").slice(-3).join(" | ") || "exit " + code), tail: out.trim() });
    });
  });
}

// opts.only (optional Set of source ids): run just those sources; the rest keep their last data and run state.
async function runRefresh(reason, opts = {}) {
  if (refresh.running) return false;
  loadDotEnv(); // pick up any .env edits (API keys etc.) made since the last refresh
  refresh.running = true; refresh.startedAt = new Date().toISOString();
  refresh.reason = reason; refresh.only = opts.only ? [...opts.only] : null; refresh.states = opts.states || null; gaveUp = null;
  rotateLog();
  log(`refresh start (${reason})`);
  try {
    const steps = feed.SOURCES.filter((s) => s.script && (!opts.only || opts.only.has(s.id)));
    for (const [i, src] of steps.entries()) {
      refresh.progress = { step: i + 1, steps: steps.length, label: src.label, done: null, total: null, current: null };
      const run = state.runs[src.id] = state.runs[src.id] || {};
      run.lastAttempt = new Date().toISOString();
      const r = await runFetcher(src, (opts.states && opts.states[src.id]) || []);
      if (r.ok) { run.lastSuccess = run.lastAttempt; run.error = null; run.skipped = false; log(`${src.id}: ok`); }
      else { run.error = r.error; run.skipped = !!r.skipped; log(`${src.id}: ${r.skipped ? "skipped" : "FAILED"} - ${r.error}`); }
      // A failed fetch leaves the previous live file untouched, so the old data stays in the feed.
    }
    const stats = feed.ingest(state);
    save();
    log(`ingested: ${stats.added} new, ${stats.changed} changed, ${stats.deactivated} dropped`);
    failedAfter = failures();
  } catch (e) {
    log("refresh error: " + (e.stack || e.message));
  } finally {
    refresh.running = false; refresh.startedAt = null; refresh.progress = null; refresh.reason = null; refresh.only = null; refresh.states = null;
  }
  scheduleFollowUp();
  return true;
}

// Follow-up refresh: the fetchers already retry inside a run, but a dropout can outlast that. If anything is still
// failing when a refresh ends (or when the service starts with failures left from the last run), run another refresh
// after RETRY_AFTER_MIN, up to RETRY_MAX times in a row, so a permanently broken source (e.g. a missing login)
// cannot cause an endless loop. A clean refresh resets the count.
const RETRY_AFTER_MIN = Number(process.env.RETRY_AFTER_MIN || 20);
const RETRY_MAX = Number(process.env.RETRY_MAX || 3);
let failedAfter = [], followUps = 0, followTimer = null;
let followInfo = null;   // what the scheduled follow-up will retry and when, for the page banner: { at, attempt, sources }
let gaveUp = null;       // set when the follow-ups ran out: { sources, at } (cleared by the next clean run or refresh)
function failures(bySource) { // sources that failed (not merely skipped) and individual states whose last fetch failed
  const out = [];
  for (const src of feed.SOURCES.filter((s) => s.script)) {
    const run = state.runs[src.id] || {};
    if (run.error && !run.skipped) out.push(src.id);
    for (const [code, r] of Object.entries((state.sources[src.id] || {}).states || {})) if (r && r.ok === false && !/Waiting for/.test(r.error || "")) out.push(bySource ? src.id : code); // "Waiting for the Gmail login" is setup, not a dropout
  }
  return bySource ? [...new Set(out)] : out;
}
// Per source: the individual state codes to re-run. Omitted when the whole script failed (then it re-runs everything).
// State codes that have an adapter, read from states/*.js (fetch-states.js is a script, so it cannot be required here).
function stateCodes() {
  const dir = path.join(__dirname, "states"), out = new Set();
  for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/code:\s*"([A-Z]{2,8})"/g)) out.add(m[1]);
  return out;
}
function failedStateCodes() {
  const out = {};
  for (const src of feed.SOURCES.filter((s) => s.script)) {
    if ((state.runs[src.id] || {}).error) continue;
    const codes = Object.entries((state.sources[src.id] || {}).states || {}).filter(([, r]) => r && r.ok === false && !/Waiting for/.test(r.error || "")).map(([c]) => c);
    if (codes.length) out[src.id] = codes;
  }
  return out;
}
function scheduleFollowUp() {
  if (followTimer) return;
  if (!failedAfter.length) { followUps = 0; followInfo = null; gaveUp = null; return; }
  if (followUps >= RETRY_MAX) { log(`still failing after ${followUps} follow-up refreshes (${failedAfter.join(", ")}); next try tomorrow morning`); gaveUp = { sources: failures(true), attempts: followUps }; followInfo = null; followUps = 0; failedAfter = []; return; }
  followUps++;
  log(`still failing: ${failedAfter.join(", ")}; follow-up refresh ${followUps}/${RETRY_MAX} in ${RETRY_AFTER_MIN} min`);
  followInfo = { at: new Date(Date.now() + RETRY_AFTER_MIN * 60000).toISOString(), attempt: followUps, max: RETRY_MAX, sources: failures(true), states: failedStateCodes() };
  followTimer = setTimeout(() => { followTimer = null; followInfo = null; runRefresh(`follow-up ${followUps}/${RETRY_MAX} after failures`, { only: new Set(failures(true)), states: failedStateCodes() }); }, RETRY_AFTER_MIN * 60000); // retry only the sources that failed
}

// Schedule: one refresh per daily cycle, and cycles start at CFG.morningHour (5:00 local by default). A refresh is due when the
// newest attempt is older than the start of the current cycle (the most recent morningHour:00), or when a source has never run
// (first install: everything runs at once, at any time of day). So the first tick/wake of the morning
// refreshes, a later restart the same day does not, and a PC left on refreshes at morningHour:00.
//
// Wake detection: a sleeping machine freezes this process, so a tick that arrives much later than
// scheduled means the machine was asleep. No OS hook or extra privilege is needed.
const TICK_MS = 30000;
function cycleStartMs(now = Date.now()) { // most recent morningHour:00 local time (yesterday's if it has not happened yet today)
  const d = new Date(now); d.setHours(CFG.morningHour, 0, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}
function lastAttemptMs() { // newest refresh attempt across sources (any outcome, so a broken source cannot cause a refresh loop)
  return Math.max(0, ...Object.values(state.runs).map((r) => Date.parse(r.lastAttempt) || 0));
}
function dueAt() { // next morningHour:00 after the last attempt (the past, if already due)
  const last = lastAttemptMs();
  if (!last) return new Date(); // nothing has run yet (epoch 0 would print as 1970): it is due now
  const d = new Date(last); d.setHours(CFG.morningHour, 0, 0, 0);
  if (d.getTime() <= last) d.setDate(d.getDate() + 1);
  return d;
}
function due() { // some runnable source has never run, or the newest attempt predates the current morning cycle
  const runnable = feed.SOURCES.filter((s) => s.script && s.needsEnv.every((k) => process.env[k]));
  return runnable.some((s) => !(state.runs[s.id] || {}).lastAttempt) || lastAttemptMs() < cycleStartMs();
}
let wakeTimer = null;
function onWake(slept) {
  if (refresh.running) { // slept mid-refresh: the fetcher's connections are dead, so stop waiting for it; it counts as failed and the follow-up retry picks it up
    if (refresh.child) { log(`woke after ~${Math.round(slept)}s asleep during a refresh; stopping the running fetcher so it can be retried`); killTree(refresh.child); }
    return;
  }
  if (wakeTimer) return;
  if (!due()) { log(`woke after ~${Math.round(slept)}s asleep; already refreshed this morning, nothing to do (next by ${dueAt().toString()})`); return; }
  log(`woke after ~${Math.round(slept)}s asleep and no refresh yet this morning; refreshing in ${CFG.wakeDelaySec}s (network may still be coming up)`);
  wakeTimer = setTimeout(() => { wakeTimer = null; runRefresh("wake from sleep, first of the morning"); }, CFG.wakeDelaySec * 1000);
}
function startScheduler() {
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), gap = now - last; last = now;
    if (gap > TICK_MS * 3) onWake(gap / 1000);                          // slept
    else if (!refresh.running && !wakeTimer && due()) runRefresh("first refresh of the morning");
  }, TICK_MS);
  log(`refresh rule: once per day, first tick/wake after ${CFG.morningHour}:00 (next by ${dueAt().toString()})`);
}

// ---- HTTP ----------------------------------------------------------------------------------------
const wantsGzip = (res) => /\bgzip\b/.test((res.req && res.req.headers["accept-encoding"]) || "");
const send = (res, code, body, type = "application/json") => {
  let buf = Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const headers = { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Accept-Encoding" };
  if (buf.length > 1024 && wantsGzip(res)) { buf = zlib.gzipSync(buf); headers["Content-Encoding"] = "gzip"; }
  res.writeHead(code, headers);
  res.end(buf);
};

function statusBody() {
  return {
    schemaVersion: feed.SCHEMA_VERSION, now: new Date().toISOString(),
    refreshing: refresh.running || !!wakeTimer, stale: !refresh.running && !wakeTimer && due(), refreshStartedAt: refresh.startedAt, refreshProgress: refresh.running ? refresh.progress : null,
    refreshReason: refresh.running ? refresh.reason : null, refreshOnly: refresh.running ? refresh.only : null, refreshStates: refresh.running ? refresh.states : null, // why it is running, and which sources when it is only a retry
    retry: followInfo, gaveUp, // scheduled follow-up: { at, attempt, max, sources }; gaveUp = follow-ups used up, next try tomorrow morning
    nextDueBy: dueAt().toISOString(),
    generatedAt: state.generatedAt || null, dataAsOf: feed.dataAsOf(state), latestSeq: state.seq, // generatedAt = feed rebuilt (also on every start); dataAsOf = oldest source's last good fetch
    activeRecords: Object.values(state.records).filter((r) => r.active).length,
    sources: feed.SOURCES.map((s) => ({
      id: s.id, label: s.label, schedulable: !!s.script,
      fetchedAt: (state.sources[s.id] || {}).fetchedAt || null,
      records: Object.values(state.records).filter((r) => r.source === s.id && r.active).length,
      ...(state.runs[s.id] || {}),
      ...(s.id === "states" ? { states: statesHealth(s.id) } : {})
    }))
  };
}

// Per-state health from the last states fetch. A failed state's older notices are still in the feed (carried over),
// so "stale" tells you the data is not from the latest fetch even though the source as a whole reported success.
function statesHealth(sourceId) {
  const meta = (state.sources[sourceId] || {}).states || {};
  const counts = {};
  for (const r of Object.values(state.records)) {
    if (r.source === sourceId && r.active) { const c = String(r.id).split("-")[0]; counts[c] = (counts[c] || 0) + 1; }
  }
  const codes = new Set([...Object.keys(meta), ...Object.keys(counts)]);
  return [...codes].sort().map((code) => {
    const m = meta[code] || {};
    return { code, ok: m.ok !== false && !!meta[code], stale: m.ok === false, error: m.error || null, partial: m.partial || null,
      lastSuccess: m.fetchedAt || null, openRecords: counts[code] || 0 };
  });
}

// The human page (index.html + live-*.js) is served to this machine only: statuses and bid interest
// are private.
const STATIC_OK = /^\/(index\.html|facts\.js|data\.js|sample-data\.js|live-(nyc|sam|states)\.js)?$/;
const PAGE_HEADERS = {
  // Defence in depth: no inline event handlers, no remote scripts, no framing, even if agency text slipped through unescaped.
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff"
};

// The page gets a slim live-states.js: every notice without its long "shall" list (fetched per notice when opened, see
// /shall/<id>) but with its bid factors already worked out from the full text, and compact JSON. Rebuilt only when the file changes.
let slim = { mtime: 0, js: null, shall: new Map() };
function slimStates() {
  const p = path.join(ROOT, "live-states.js");
  const mtime = fs.statSync(p).mtimeMs + fs.statSync(path.join(ROOT, "facts.js")).mtimeMs; // rebuild when the fact rules change too
  if (slim.js && slim.mtime === mtime) return slim;
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(p, "utf8"), sandbox, { timeout: 10000 }); // our own generated file
  const entry = (sandbox.window.LIVE_SOURCES || [])[0];
  if (!entry) throw new Error("live-states.js has no data");
  const shall = new Map();
  const rfqs = entry.rfqs.map((r) => {
    const { shall: list, ...rest } = r;
    rest.facts = computeFacts(r);
    rest.shallCount = (list || []).length;
    if (rest.shallCount) shall.set(r.id, list);
    return rest;
  });
  const js = "(window.LIVE_SOURCES = window.LIVE_SOURCES || []).push(" + JSON.stringify({ meta: entry.meta, rfqs }) + ");\n";
  slim = { mtime, js, shall, gz: null };
  return slim;
}

const gzCache = new Map(); // file -> { mtime, gz }
function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const type = file.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8";
  let buf, mtime;
  try {
    const full = path.join(ROOT, file);
    mtime = fs.statSync(full).mtimeMs;
    if (file === "live-states.js") { const s = slimStates(); buf = Buffer.from(s.js); mtime = s.mtime; }
    else buf = fs.readFileSync(full);
  } catch (e) {
    return send(res, 404, { error: "not found" });
  }
  const etag = '"' + mtime.toString(36) + "-" + buf.length.toString(36) + '"';
  // Revalidate each time (the files change when a refresh finishes) but skip the download when nothing changed.
  const headers = { ...PAGE_HEADERS, "Content-Type": type, "Cache-Control": "no-cache", "ETag": etag, "Vary": "Accept-Encoding" };
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
  if (wantsGzip(res) && buf.length > 1024) {
    let c = gzCache.get(file);
    if (!c || c.etag !== etag) { c = { etag, gz: zlib.gzipSync(buf) }; gzCache.set(file, c); }
    buf = c.gz; headers["Content-Encoding"] = "gzip";
  }
  res.writeHead(200, headers);
  res.end(buf);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = url.pathname.replace(/\/+$/, "") || "/";
    const local = isLoopback(req.socket.remoteAddress) || req.socket.remoteAddress === "::ffff:127.0.0.1";

    // DNS-rebinding guard: a hostile page can point its own domain at 127.0.0.1 and make the browser
    // send requests here that look same-origin and "local". The Host header then carries the attacker's
    // domain, so only loopback names (plus any in ALLOWED_HOSTS, comma-separated) are served.
    const hostName = (() => {
      const h = String(req.headers.host || "").toLowerCase();
      return h.startsWith("[") ? h.slice(0, h.indexOf("]") + 1) : h.split(":")[0];
    })();
    if (!(hostName === "localhost" || hostName === "127.0.0.1" || hostName === "[::1]" || ALLOWED_HOSTS.includes(hostName))) {
      return send(res, 403, { error: "unrecognized Host header (set ALLOWED_HOSTS to add this name)" });
    }

    if (p === "/api/health" && req.method === "GET") { // no auth: for uptime checks; reveals nothing sensitive
      const lastOk = Object.values(state.runs).map((r) => r.lastSuccess).filter(Boolean).sort().pop() || null;
      return send(res, 200, { ok: true, lastSuccessfulRefresh: lastOk, dataAsOf: feed.dataAsOf(state) }); // use dataAsOf for freshness: lastSuccessfulRefresh is the NEWEST source
    }
    if (p.startsWith("/api/")) {
      if (p === "/api/status" && req.method === "GET") return send(res, 200, statusBody());
      if (p === "/api/rfqs" && req.method === "GET") return send(res, 200, feed.query(state, url.searchParams));
      const one = /^\/api\/rfqs\/([^/]+)$/.exec(p);
      if (one && req.method === "GET") {
        let id; try { id = decodeURIComponent(one[1]); } catch { return send(res, 400, { error: "malformed id" }); } // a stray "%" is the caller's mistake, not a server error
        const rec = Object.hasOwn(state.records, id) ? state.records[id] : null; // not inherited keys like "constructor"
        return rec ? send(res, 200, feed.publicRecord(rec)) : send(res, 404, { error: "no such request" });
      }
      if (p === "/api/refresh" && req.method === "POST") {
        // Costs SAM quota and Anthropic spend, so it is gated. With REFRESH_TOKEN set, a matching
        // bearer token is required (from anywhere). Without it, only loopback callers are allowed,
        // and never a cross-site browser request (Origin must be absent or same-host).
        const token = process.env.REFRESH_TOKEN;
        if (token) {
          const given = /^Bearer (.+)$/i.exec(req.headers.authorization || "")?.[1] || req.headers["x-refresh-token"] || "";
          const a = Buffer.from(String(given)), b = Buffer.from(token);
          if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return send(res, 401, { error: "refresh token required" });
        } else {
          if (!local) return send(res, 403, { error: "refresh is only allowed from this machine (or set REFRESH_TOKEN)" });
          const origin = req.headers.origin;
          if (origin) {
            let oh = null; try { oh = new URL(origin).host; } catch {}
            if (oh !== req.headers.host) return send(res, 403, { error: "cross-site request refused" });
          }
        }
        if (refresh.running) return send(res, 409, { error: "a refresh is already running", startedAt: refresh.startedAt });
        // ?failed=1: retry only the sources that failed last time (what the page does on load), not everything.
        let only, states;
        if (url.searchParams.get("failed") === "1") {
          const ids = failures(true);
          if (!ids.length) return send(res, 200, { started: false, reason: "nothing failed" });
          only = new Set(ids);
          states = failedStateCodes(); // within a source, re-run only the states that failed (same as the scheduled follow-up)
        }
        // ?portal=sam | nyc | states | state:XX: refresh just that portal (Federal, local, all states, or one state).
        const portal = url.searchParams.get("portal");
        if (portal) {
          // Comma-separated list, e.g. sam,nyc,state:NY,state:CA. "states" = every state; state:XX = just that state.
          only = new Set(); const codes = []; let allStates = false;
          for (const part of portal.split(",")) {
            const m = /^state:([A-Za-z]{2,8})$/.exec(part);
            if (m) {
              if (!stateCodes().has(m[1].toUpperCase())) return send(res, 400, { error: "unknown state: " + m[1] }); // e.g. TX (now TXDOT): would otherwise run nothing and show up as a failed refresh
              codes.push(m[1].toUpperCase());
            }
            else if (part === "states") allStates = true;
            else if (feed.SOURCES.some((s) => s.script && s.id === part)) only.add(part);
            else return send(res, 400, { error: "unknown portal" });
          }
          if (allStates || codes.length) only.add("states");
          if (!allStates && codes.length) states = { states: codes };
        }
        if (followTimer) { clearTimeout(followTimer); followTimer = null; followUps = 0; } // this run replaces the scheduled follow-up
        runRefresh(portal ? "api request, portal " + portal : only ? "page opened, retrying failed sources" : "api request", only ? { only, states } : {}); // not awaited: a refresh takes minutes; poll /api/status
        return send(res, 202, { started: true, only: only ? [...only] : null });
      }
      return send(res, 404, { error: "unknown endpoint" });
    }
    if (req.method === "GET" && local && STATIC_OK.test(p)) return serveStatic(req, res, p);
    const sh = /^\/shall\/([^/]+)$/.exec(p);
    if (req.method === "GET" && local && sh) { // the long "shall" list of one notice, for the page
      try { return send(res, 200, { shall: slimStates().shall.get(decodeURIComponent(sh[1])) || [] }); }
      catch { return send(res, 404, { error: "not found" }); }
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    if (e.status === 400) return send(res, 400, { error: e.message });
    log("request error: " + e.message);
    send(res, 500, { error: "internal error" });
  }
});

// ---- start -----------------------------------------------------------------------------------------
if (process.argv.includes("--once")) {
  runRefresh("--once").then(() => process.exit(0));
} else {
  server.on("error", (e) => { // e.g. a second copy started while the first is running
    log(e.code === "EADDRINUSE" ? `port ${CFG.port} is already in use (another copy of the service is running); exiting` : "server error: " + e.message);
    process.exit(e.code === "EADDRINUSE" ? 0 : 1);
  });
  server.listen(CFG.port, CFG.host, () => {
    log(`listening on http://${CFG.host}:${CFG.port} `);
    for (const s of feed.SOURCES.filter((x) => x.script)) {
      const miss = s.needsEnv.filter((k) => !process.env[k]);
      if (miss.length) log(`WARNING: ${s.label} will be skipped: ${miss.join(", ")} not set`);
    }
    if (!process.env.ANTHROPIC_API_KEY) log("note: ANTHROPIC_API_KEY not set - no AI reading (scope/requires/shall will be thin)");
    const stats = feed.ingest(state); // pick up any live-*.js already on disk
    if (stats.added || stats.changed || stats.deactivated) save();
    startScheduler();
    if (!due()) { failedAfter = failures(); scheduleFollowUp(); } // failures left from the last run: retry soon, not tomorrow
  });
  const stop = () => { log("stopping"); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
