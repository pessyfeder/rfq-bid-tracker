# Installing the RFQ service on Israel's machine

This is a standalone service on **one machine** (the "service machine"). It fetches solicitations from NYC and SAM.gov on a schedule, keeps them in `data/`, and serves them as JSON. A **second machine** reads that JSON, filters it, and feeds the bidding app. The JSON contract is in `FEED.md`.

```
 NYC / SAM.gov / USAspending / Anthropic  -->  [service machine: server.js]  -->  HTTP + token  -->  [reader machine]  -->  bidding app
                                                 fetchers, data/state.json
```

No secrets belong in git or in this file. Keys live in environment variables or a git-ignored `.env` file on the service machine only.

## 1. What the service machine needs

- Node.js, recent LTS (`node --version`; 18 or newer). No `npm install`: there are no dependencies.
- Always on (or at least on around 02:00 and whenever the reader polls). If it was off at 02:00, it refreshes on start-up when the data is over a day old.
- Outbound internet to sam.gov, data.cityofnewyork.us, usaspending.gov, api.anthropic.com.
- The reader machine must be able to reach the service on its port (default 8765): allow it in the firewall for the reader's address only.

## 2. Put the project on the machine

```powershell
git clone <repo-url> C:\rfq-bid-tracker
cd C:\rfq-bid-tracker
```

(Linux: `/opt/rfq-bid-tracker`.)

## 3. Configuration

Create a file named `.env` in the project folder (git-ignored). Restrict who can read it (Windows: right-click > Properties > Security, leave only Israel's account and SYSTEM; Linux: `chmod 600 .env`).

```
# Shared secret the reader machine must send. Required. Make it long and random, e.g.:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
RFQ_API_TOKEN=paste-the-random-string-here

SAM_API_KEY=your-sam-key
ANTHROPIC_API_KEY=sk-ant-your-key

# Optional (defaults shown)
# PORT=8765
# HOST=0.0.0.0        # use 127.0.0.1 to allow only this machine (then no token is needed)
# REFRESH_AT=02:00    # local time, once a day
```

Notes:

- **SAM_API_KEY** from sam.gov > Account Details > API Key. A personal key allows roughly 10 requests a day, and a refresh uses many (one per notice description). If SAM shows rate-limit errors in `/api/status`, see the SAM limit note in spec 2n. Without the key SAM is skipped and NYC still works.
- **ANTHROPIC_API_KEY**: a **new** key made for this machine (see `anthropic-key-setup.md`). Without it the feed works but `scope`, `requires` and `shall` are thin, which weakens the reader's filtering.
- The service refuses to start on a network address with no `RFQ_API_TOKEN`.
- Environment variables set in the system override the `.env` file.

Give the reader's developer the token and `FEED.md`.

## 4. Try it by hand

```powershell
node server.js --once     # fetch everything once, write data\feed.json, exit (takes a few minutes with AI reading on)
node server.js            # start the service
```

Then, from the reader machine (or this one):

```powershell
curl http://<service-machine>:8765/api/health
curl -H "Authorization: Bearer <token>" http://<service-machine>:8765/api/status
```

`/api/status` should show each source with a recent `lastSuccess` and `error: null`. The first start with no data triggers a refresh by itself. Logs: `data\service.log`.

## 5. Keep it running

### Windows

Simplest: Task Scheduler.

1. Create Task > General: name "RFQ service", "Run whether user is logged on or not", "Run with highest privileges" off.
2. Triggers: **At startup**.
3. Actions: Start a program `C:\rfq-bid-tracker\start.cmd`, Start in `C:\rfq-bid-tracker`. (`start.cmd` restarts the service if it ever exits.)
4. Settings: untick "Stop the task if it runs longer than".
5. Windows Firewall: add an inbound rule for TCP 8765, scope "Remote IP address" to the reader machine only.

Alternative: NSSM (`nssm install rfq-service "C:\Program Files\nodejs\node.exe" server.js`, startup directory the project folder) gives a real Windows service.

### Linux (systemd)

`/etc/systemd/system/rfq-service.service`:

```
[Unit]
Description=RFQ service
After=network-online.target

[Service]
WorkingDirectory=/opt/rfq-bid-tracker
ExecStart=/usr/bin/node server.js
Restart=always
User=rfq

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now rfq-service
journalctl -u rfq-service -n 50
```

The service reads `.env` itself, so no `EnvironmentFile=` is needed.

## 6. Look after it

- **Freshness**: the reader should check `/api/status` (or `/api/health`'s `lastSuccessfulRefresh`) and alert if it is over ~26 hours old.
- **Back up** `data/state.json` and `ai-cache.json`. The data itself rebuilds on the next refresh, but losing `state.json` resets the `seq` cursor (the reader would see everything as new), and losing `ai-cache.json` makes every notice be re-read and re-billed.
- **Cost**: after the first nightly run, check Anthropic Console > Usage; each run also appends to `ai-usage.log`.
- **Key leaks**: delete the key in its service's site, make a new one, edit `.env`, restart the service. To rotate `RFQ_API_TOKEN`, change it in `.env` and on the reader, then restart.
- **Manual refresh**: `POST /api/refresh` with the token, or restart the service.
- The service is HTTP, not HTTPS. Keep both machines on a trusted network or VPN; if they must talk across the internet, put a TLS reverse proxy (Caddy) in front.

## 7. The human page

`http://localhost:8765/` on the service machine itself still serves the table page (`index.html`). It is not served to other machines: the reader uses the API, and a browser cannot send the token. The page has no bid statuses and stores nothing, so it is a read-only view of the same data.

## 8. Not built yet

- NYS Contract Reporter (no source; see spec section 3).
- Delivery by push (webhook) instead of polling: the reader polls `?after=<cursor>` today.
- HTTPS and per-reader tokens.
