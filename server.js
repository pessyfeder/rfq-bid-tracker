// RFQ Bid Tracker - standalone service.
//
// One process that (1) runs the fetchers (on wake from sleep, or every 24 h), (2) keeps the results in data/state.json,
// and (3) serves them as JSON to the other machine over HTTP. See FEED.md for the API and DEPLOY.md
// for installation. No npm dependencies; Node 18+.
//
//   node server.js            start the service
//   node server.js --once     run one refresh now, write data/feed.json, exit (no HTTP)

const fs = require("fs");
const path = require("path");
const http = require("http");
const zlib = require("zlib");
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
(function loadDotEnv() {
  let text;
  try { text = fs.readFileSync(path.join(ROOT, ".env"), "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
})();

const CFG = {
  host: process.env.HOST || "127.0.0.1",           // this machine only unless HOST is set (HOST=0.0.0.0 for all interfaces)
  port: Number(process.env.PORT || 8765),
  maxAgeHours: Number(process.env.REFRESH_MAX_AGE_HOURS || 24), // refresh when the last attempt is this old
  wakeDelaySec: Number(process.env.WAKE_DELAY_SEC || 45),       // after a wake, wait for Wi-Fi/VPN before fetching
  fetchTimeoutMin: Number(process.env.FETCH_TIMEOUT_MIN || 45)
};
const isLoopback = (h) => h === "127.0.0.1" || h === "::1" || h === "localhost";

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
const refresh = { running: false, startedAt: null };

function save() {
  feed.writeAtomic(STATE_FILE, JSON.stringify(state));
  feed.writeAtomic(SNAPSHOT_FILE, JSON.stringify(feed.query(state, new URLSearchParams("open=0&limit=5000")), null, 1));
}

// ---- running the fetchers ------------------------------------------------------------------------
function runFetcher(src) {
  return new Promise((resolve) => {
    const missing = src.needsEnv.filter((k) => !process.env[k]);
    if (missing.length) return resolve({ ok: false, skipped: true, error: `${missing.join(", ")} not set` });
    const child = spawn(process.execPath, [src.script], { cwd: ROOT, env: process.env, windowsHide: true });
    let out = "";
    const keep = (b) => { out = (out + b).slice(-4000); };
    child.stdout.on("data", keep); child.stderr.on("data", keep);
    const timer = setTimeout(() => { out += "\n[killed: timeout]"; child.kill(); }, CFG.fetchTimeoutMin * 60000);
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, error: code === 0 ? null : (out.trim().split("\n").slice(-3).join(" | ") || "exit " + code), tail: out.trim() });
    });
  });
}

async function runRefresh(reason) {
  if (refresh.running) return false;
  refresh.running = true; refresh.startedAt = new Date().toISOString();
  rotateLog();
  log(`refresh start (${reason})`);
  try {
    for (const src of feed.SOURCES.filter((s) => s.script)) {
      const run = state.runs[src.id] = state.runs[src.id] || {};
      run.lastAttempt = new Date().toISOString();
      const r = await runFetcher(src);
      if (r.ok) { run.lastSuccess = run.lastAttempt; run.error = null; run.skipped = false; log(`${src.id}: ok`); }
      else { run.error = r.error; run.skipped = !!r.skipped; log(`${src.id}: ${r.skipped ? "skipped" : "FAILED"} - ${r.error}`); }
      // A failed fetch leaves the previous live file untouched, so the old data stays in the feed.
    }
    const stats = feed.ingest(state);
    save();
    log(`ingested: ${stats.added} new, ${stats.changed} changed, ${stats.deactivated} dropped`);
  } catch (e) {
    log("refresh error: " + (e.stack || e.message));
  } finally {
    refresh.running = false; refresh.startedAt = null;
  }
  return true;
}

// Schedule: no clock times. A refresh starts only once the last refresh attempt is 24 hours old: as soon as
// that is true while awake, or, if the machine was asleep when the 24 hours ran out, right after it wakes. The service itself is started at boot by Task
// Scheduler ("At startup", whether or not anyone is logged on - see DEPLOY.md), so it is already
// running when the machine wakes at the lock screen.
//
// Wake detection: a sleeping machine freezes this process, so a tick that arrives much later than
// scheduled means the machine was asleep. No OS hook or extra privilege is needed.
const TICK_MS = 30000;
const DAY_MS = () => CFG.maxAgeHours * 3600000;
function lastAttemptMs() { // newest refresh attempt across sources (any outcome, so a broken source cannot cause a refresh loop)
  return Math.max(0, ...Object.values(state.runs).map((r) => Date.parse(r.lastAttempt) || 0));
}
function dueAt() { return new Date(lastAttemptMs() + DAY_MS()); }
function due() { // the 24-hour rule: some runnable source has never run, or the newest attempt is over 24 h old
  const runnable = feed.SOURCES.filter((s) => s.script && s.needsEnv.every((k) => process.env[k]));
  return runnable.some((s) => !(state.runs[s.id] || {}).lastAttempt) || Date.now() - lastAttemptMs() >= DAY_MS();
}
let wakeTimer = null;
function onWake(slept) {
  if (wakeTimer || refresh.running) return;
  if (!due()) { log(`woke after ~${Math.round(slept)}s asleep; last refresh under ${CFG.maxAgeHours} h ago, nothing to do (next by ${dueAt().toString()})`); return; }
  log(`woke after ~${Math.round(slept)}s asleep and ${CFG.maxAgeHours} h have passed; refreshing in ${CFG.wakeDelaySec}s (network may still be coming up)`);
  wakeTimer = setTimeout(() => { wakeTimer = null; runRefresh("wake from sleep, 24 h or more since the last refresh"); }, CFG.wakeDelaySec * 1000);
}
function startScheduler() {
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), gap = now - last; last = now;
    if (gap > TICK_MS * 3) onWake(gap / 1000);                          // slept
    else if (!refresh.running && !wakeTimer && due()) runRefresh("24 hours since the last refresh");
  }, TICK_MS);
  log(`refresh rule: ${CFG.maxAgeHours} h after the last attempt (on wake if it came due asleep) (next by ${dueAt().toString()})`);
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
    refreshing: refresh.running, refreshStartedAt: refresh.startedAt, nextDueBy: dueAt().toISOString(),
    generatedAt: state.generatedAt || null, latestSeq: state.seq,
    activeRecords: Object.values(state.records).filter((r) => r.active).length,
    sources: feed.SOURCES.map((s) => ({
      id: s.id, label: s.label, schedulable: !!s.script,
      fetchedAt: (state.sources[s.id] || {}).fetchedAt || null,
      records: Object.values(state.records).filter((r) => r.source === s.id && r.active).length,
      ...(state.runs[s.id] || {})
    }))
  };
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
  const mtime = fs.statSync(p).mtimeMs;
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

    if (p === "/api/health" && req.method === "GET") { // no auth: for uptime checks; reveals nothing sensitive
      const lastOk = Object.values(state.runs).map((r) => r.lastSuccess).filter(Boolean).sort().pop() || null;
      return send(res, 200, { ok: true, lastSuccessfulRefresh: lastOk });
    }
    if (p.startsWith("/api/")) {
      if (p === "/api/status" && req.method === "GET") return send(res, 200, statusBody());
      if (p === "/api/rfqs" && req.method === "GET") return send(res, 200, feed.query(state, url.searchParams));
      const one = /^\/api\/rfqs\/([^/]+)$/.exec(p);
      if (one && req.method === "GET") {
        const rec = state.records[decodeURIComponent(one[1])];
        return rec ? send(res, 200, feed.publicRecord(rec)) : send(res, 404, { error: "no such request" });
      }
      if (p === "/api/refresh" && req.method === "POST") {
        if (refresh.running) return send(res, 409, { error: "a refresh is already running", startedAt: refresh.startedAt });
        runRefresh("api request"); // not awaited: a refresh takes minutes; poll /api/status
        return send(res, 202, { started: true });
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
    log("request error: " + e.message);
    send(res, 500, { error: "internal error" });
  }
});

// ---- start -----------------------------------------------------------------------------------------
if (process.argv.includes("--once")) {
  runRefresh("--once").then(() => process.exit(0));
} else {
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
    if (due()) runRefresh("start-up, data missing or over a day old");
  });
  const stop = () => { log("stopping"); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
