# Installing the RFQ service on Israel's machine

This is a standalone service on **one machine** (the "service machine"). It fetches solicitations from NYC and SAM.gov on a schedule, keeps them in `data/`, and serves them as JSON. A **second machine** reads that JSON, filters it, and feeds the bidding app. The JSON contract is in `FEED.md`.

```
 NYC / SAM.gov / USAspending / Anthropic  -->  [service machine: server.js]  -->  HTTP  -->  [reader machine]  -->  bidding app
                                                 fetchers, data/state.json
```

No secrets belong in this file. Keys live in environment variables or a `.env` file on the service machine only.

## 1. What the service machine needs

- Node.js, recent LTS (`node --version`; 18 or newer). No `npm install`: there are no dependencies.
- Always on (or at least on around 09:00 and whenever the reader polls). If it was off at 09:00, it refreshes on start-up when the data is over a day old.
- Outbound internet to sam.gov, data.cityofnewyork.us, usaspending.gov, api.anthropic.com.
- The service listens on this machine only (`HOST=127.0.0.1` in `.env`), so no firewall change is needed.

## 2. Put the project on the machine

**From the zip (simplest):**

1. Save `rfq-bid-tracker.zip` anywhere, for example your Downloads folder.
2. Right-click it > **Extract All**. This makes a folder called `rfq-bid-tracker`.
3. Move that folder to `C:\` so the path is `C:\rfq-bid-tracker`. Any other location works too. Wherever you put it, that is "the project folder" in the steps below.

(Linux: extract the zip to `/opt/rfq-bid-tracker`.)

## 3. Create your keys

You need two values. They go in a `.env` file in the next step. Never email them or paste them in chat.

| Value | Where it comes from |
|---|---|
| `SAM_API_KEY` | sam.gov > sign in > Account Details > API Key. Without it, SAM.gov is skipped and NYC still works. |
| `ANTHROPIC_API_KEY` | A **new** key made for this machine only (see `anthropic-key-setup.md`). Do not reuse anyone else's key. Without it the feed works, but `scope`, `requires` and `shall` are thin, which weakens the reader's filtering. |

## 4. Create the `.env` file

1. Open the project folder in File Explorer. The zip already contains an empty `.env` file with the names and no values. (If you can't see it, Windows may be hiding dot-files: turn on View > Show > Hidden items. If it is missing, create a new text file named exactly `.env`, with no `.txt` at the end; turn on View > Show > File name extensions so you can check.)
2. Right-click `.env` > Open with > Notepad.
3. Type each value after its `=` sign, with no spaces or quotes:

```
SAM_API_KEY=your-sam-key
ANTHROPIC_API_KEY=sk-ant-your-key
HOST=127.0.0.1
```

4. Save it. Restrict who can read it: right-click > Properties > Security, and leave only your own account and SYSTEM. (Linux: `chmod 600 .env`.)

Optional settings you can add to the same file (defaults shown):

```
# PORT=8765
# REFRESH_AT=09:00      # local time, once a day
# SAM_DAILY_BUDGET=10   # see the note below
```

Notes:

- **SAM_DAILY_BUDGET** is the most SAM.gov requests the service makes per UTC day. The default, 10, is a personal key's limit; an entity-linked key allows about 1,000, so set it to your key's real limit. The service only asks for new postings, reads each description once, and stops cleanly at the budget; leftover work continues the next day. `/api/status` shows `descriptionsWaiting` and `requestsUsedToday`. With a 10-a-day key the backlog will not clear: expect a few new federal requests per day to get full detail and the rest listed with basic fields only.
- `HOST=127.0.0.1` keeps the service reachable from this machine only. Leave it as is.
- Environment variables set in the system override the `.env` file.

## 5. Try it by hand

Open PowerShell **in the project folder**. The easy way: open the folder in File Explorer, click the address bar, type `powershell`, press Enter.

```powershell
node server.js --once
```

This fetches everything once, writes `data\feed.json` and exits. With AI reading on it takes a few minutes. Then start the service:

```powershell
node server.js
```

Leave that window open. In a second PowerShell window, check that it works:

```powershell
curl http://localhost:8765/api/health
curl http://localhost:8765/api/status
```

`/api/status` should show each source with a recent `lastSuccess` and `error: null`. Logs: `data\service.log`.

## 6. Keep it running

### Windows

Simplest: Task Scheduler.

1. Create Task > General: name "RFQ service", "Run whether user is logged on or not", "Run with highest privileges" off.
2. Triggers: **At startup**.
3. Actions: Start a program = `start.cmd` in the project folder (full path), and Start in = the project folder. (`start.cmd` restarts the service if it ever exits.)
4. Settings: untick "Stop the task if it runs longer than".

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

## 7. Look after it

- **Freshness**: the reader should check `/api/status` (or `/api/health`'s `lastSuccessfulRefresh`) and alert if it is over ~26 hours old.
- **Back up** `data/state.json` and `ai-cache.json`. The data itself rebuilds on the next refresh, but losing `state.json` resets the `seq` cursor (the reader would see everything as new), and losing `ai-cache.json` makes every notice be re-read and re-billed.
- **Cost**: after the first daily run, check Anthropic Console > Usage; each run also appends to `ai-usage.log`.
- **Key leaks**: delete the key on its service's site, make a new one, edit `.env`, restart the service.- **Manual refresh**: `POST /api/refresh`, or restart the service.
- The service is HTTP, not HTTPS. Keep both machines on a trusted network or VPN; if they must talk across the internet, put a TLS reverse proxy (Caddy) in front.

## 8. The human page

`http://localhost:8765/` on the service machine itself still serves the table page (`index.html`). It is not served to other machines: the reader uses the API. The page has no bid statuses and stores nothing, so it is a read-only view of the same data.

## 9. Not built yet

- NYS Contract Reporter (no source; see spec section 3).
- Delivery by push (webhook) instead of polling: the reader polls `?after=<cursor>` today.
- HTTPS.
