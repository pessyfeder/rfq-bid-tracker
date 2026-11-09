// RFQ Bid Tracker - standalone service.
//
// One process that (1) runs the fetchers on a schedule, (2) keeps the results in data/state.json,
// and (3) serves them as JSON to the other machine over HTTP. See FEED.md for the API and DEPLOY.md
// for installation. No npm dependencies; Node 18+.
//
//   node server.js            start the service
//   node server.js --once     run one refresh now, write data/feed.json, exit (no HTTP)

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");
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
  host: process.env.HOST || "0.0.0.0",             // the reader is a different machine, so listen on the network
  port: Number(process.env.PORT || 8765),
  token: process.env.RFQ_API_TOKEN || "",          // shared secret the reading machine sends as a Bearer token
  refreshAt: process.env.REFRESH_AT || "02:00",    // local time, HH:MM; daily
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

// Schedule: once a day at REFRESH_AT (local). On start-up, refresh at once if the last successful
// run of any schedulable source is missing or older than a day (e.g. the machine was off at 02:00).
function nextRun() {
  const [h, m] = CFG.refreshAt.split(":").map(Number);
  const t = new Date(); t.setHours(h, m, 0, 0);
  if (t <= new Date()) t.setDate(t.getDate() + 1);
  return t;
}
function scheduleLoop() {
  const t = nextRun();
  setTimeout(async () => { await runRefresh("scheduled"); scheduleLoop(); }, Math.max(1000, t - Date.now())).unref?.();
  log(`next scheduled refresh: ${t.toString()}`);
}
function stale() {
  const day = 86400000;
  return feed.SOURCES.filter((s) => s.script && s.needsEnv.every((k) => process.env[k])).some((s) => {
    const r = state.runs[s.id];
    return !r || !r.lastSuccess || Date.now() - Date.parse(r.lastSuccess) > day;
  });
}

// ---- HTTP ----------------------------------------------------------------------------------------
function authorized(req) {
  if (!CFG.token) return true; // only possible on a loopback-only bind (checked at start-up)
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const a = crypto.createHash("sha256").update(m[1]).digest(), b = crypto.createHash("sha256").update(CFG.token).digest();
  return crypto.timingSafeEqual(a, b);
}
const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

function statusBody() {
  return {
    schemaVersion: feed.SCHEMA_VERSION, now: new Date().toISOString(),
    refreshing: refresh.running, refreshStartedAt: refresh.startedAt, nextScheduled: nextRun().toISOString(),
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
// are private, and the remote reader uses the API.
const STATIC_OK = /^\/(index\.html|data\.js|sample-data\.js|live-(nyc|sam|ny-state)\.js)?$/;
function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  fs.readFile(path.join(ROOT, file), (err, buf) => {
    if (err) return send(res, 404, { error: "not found" });
    res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", "Cache-Control": "no-store",
      // Defence in depth: no inline event handlers, no remote scripts, no framing, even if agency text slipped through unescaped.
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff" });
    res.end(buf);
  });
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
      if (!authorized(req)) { res.setHeader("WWW-Authenticate", "Bearer"); return send(res, 401, { error: "missing or wrong token" }); }
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
  if (!CFG.token && !isLoopback(CFG.host)) {
    console.error("Refusing to start: RFQ_API_TOKEN is not set and HOST is " + CFG.host + ".\n" +
      "Set RFQ_API_TOKEN to a long random string (the reading machine sends it as 'Authorization: Bearer <token>'),\n" +
      "or set HOST=127.0.0.1 to listen on this machine only.");
    process.exit(1);
  }
  if (!/^\d{1,2}:\d{2}$/.test(CFG.refreshAt)) { console.error("REFRESH_AT must look like 02:00"); process.exit(1); }
  server.listen(CFG.port, CFG.host, () => {
    log(`listening on http://${CFG.host}:${CFG.port} (token ${CFG.token ? "required" : "off, loopback only"})`);
    for (const s of feed.SOURCES.filter((x) => x.script)) {
      const miss = s.needsEnv.filter((k) => !process.env[k]);
      if (miss.length) log(`WARNING: ${s.label} will be skipped: ${miss.join(", ")} not set`);
    }
    if (!process.env.ANTHROPIC_API_KEY) log("note: ANTHROPIC_API_KEY not set - no AI reading (scope/requires/shall will be thin)");
    const stats = feed.ingest(state); // pick up any live-*.js already on disk
    if (stats.added || stats.changed || stats.deactivated) save();
    scheduleLoop();
    if (stale()) runRefresh("start-up, data missing or over a day old");
  });
  const stop = () => { log("stopping"); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
