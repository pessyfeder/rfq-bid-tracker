# Installing the RFQ service

This is a standalone service on **one machine** (the "service machine"). It fetches solicitations from NYC and SAM.gov every 24 hours (after a sleep, right on waking), keeps them in `data/`, and serves them as JSON. The JSON contract is in `FEED.md`.

```
 NYC / SAM.gov / USAspending / Anthropic  -->  [service machine: server.js]  -->  JSON on localhost
                                                 fetchers, data/state.json
```

No secrets belong in this file. Keys live in environment variables or a `.env` file on the service machine only.

## 1. What the service machine needs

- Node.js, recent LTS (`node --version`; 18 or newer). No `npm install`: there are no dependencies.
- Can sleep. The service refreshes once 24 hours have passed since the last refresh attempt: while awake as soon as it is due, or, if the 24 hours ran out while the machine slept, right after it wakes (also at start-up if the data is over a day old). A wake sooner than 24 hours after the last refresh does nothing. There is no fixed time of day. It must be started at boot (section 6) so it is already running when the machine wakes at the lock screen, before anyone logs in.
- Outbound internet to sam.gov, data.cityofnewyork.us, usaspending.gov, api.anthropic.com.
- The service listens on this machine only (the default; `.env` also sets `HOST=127.0.0.1` to make it explicit), so no firewall change is needed.

## 2. Put the project on the machine

Extract `rfq-bid-tracker.zip` to a permanent location. That folder is "the project folder" in the steps below.

**Windows:**

1. Save the zip anywhere, for example your Downloads folder.
2. Right-click it > **Extract All**. This makes a folder called `rfq-bid-tracker`.
3. Move that folder to `C:\` so the path is `C:\rfq-bid-tracker`. Any other location works too.

**Linux / macOS:**

```bash
sudo unzip rfq-bid-tracker.zip -d /opt
```

This gives `/opt/rfq-bid-tracker`. Make sure the account that will run the service owns it (for example `sudo chown -R rfq /opt/rfq-bid-tracker`).

## 3. Create your keys

You need two values. They go in a `.env` file in the next step. Never email them or paste them in chat.

| Value | Where it comes from |
|---|---|
| `SAM_API_KEY` | sam.gov > sign in > Account Details > API Key. Without it, SAM.gov is skipped and NYC still works. |
| `ANTHROPIC_API_KEY` | A **new** key made for this machine only (see `anthropic-key-setup.md`). Do not reuse anyone else's key. Without it the feed works, but `scope`, `requires` and `shall` are thin. |
| `PA_GMAIL_USER`, `PA_GMAIL_APP_PASSWORD` | Optional. The Gmail account that receives the Pennsylvania eAlert emails, and a Google app password for it (Google Account > Security > 2-Step Verification, then App passwords; IMAP must be on). Read-only: only emails from RA-paealerts@pa.gov in the last 90 days are read. Without them Pennsylvania shows no notices (there is no manual route). |

## 4. Create the `.env` file

1. The zip already contains an empty `.env` file in the project folder with the names and no values.
   - **Windows:** open the folder in File Explorer. If you can't see the file, turn on View > Show > Hidden items. If it is missing, create a new text file named exactly `.env`, with no `.txt` at the end (turn on View > Show > File name extensions so you can check).
   - **Linux / macOS:** it is a dot-file, so use `ls -a`. If it is missing, `touch .env`.
2. Open it in a text editor: on Windows, right-click `.env` > Open with > Notepad; on Linux / macOS, `nano .env`.
3. Type each value after its `=` sign, with no spaces or quotes:

```
SAM_API_KEY=your-sam-key
ANTHROPIC_API_KEY=sk-ant-your-key
PA_GMAIL_USER=your-alerts-account@gmail.com
PA_GMAIL_APP_PASSWORD=your-16-character-app-password
HOST=127.0.0.1
```

4. Save it. Restrict who can read it: right-click > Properties > Security, and leave only your own account and SYSTEM. (Linux: `chmod 600 .env`.)

Optional settings you can add to the same file (defaults shown):

```
# PORT=8765
# REFRESH_MAX_AGE_HOURS=24   # refresh when the last attempt is this old
# WAKE_DELAY_SEC=45          # wait after a wake for the network to come up
# SAM_DAILY_BUDGET=10   # see the note below
```

Notes:

- **SAM_DAILY_BUDGET** is the most SAM.gov requests the service makes per UTC day. The default, 10, is a personal key's limit; an entity-linked key allows about 1,000, so set it to your key's real limit. The service only asks for new postings, reads each description once, and stops cleanly at the budget; leftover work continues the next day. `/api/status` shows `descriptionsWaiting` and `requestsUsedToday`. With a 10-a-day key the backlog will not clear: expect a few new federal requests per day to get full detail and the rest listed with basic fields only.
- `HOST=127.0.0.1` keeps the service reachable from this machine only. Leave it as is. If you remove `HOST`, the service still listens on this machine only (that is the default). It listens on other network interfaces only if you set `HOST` to `0.0.0.0` or another address (see section 9), and the API has no authentication.
- Environment variables set in the system override the `.env` file.

## 5. Try it by hand

Open a terminal **in the project folder**. On Windows, the easy way is to open the folder in File Explorer, click the address bar, type `powershell`, press Enter. On Linux / macOS, `cd /opt/rfq-bid-tracker`.

```
node server.js --once
```

This fetches everything once, writes `data/feed.json` and exits. With AI reading on it takes a few minutes. Then start the service:

```
node server.js
```

Leave that window open. In a second terminal, check that it works (on Windows PowerShell, use `curl.exe` in place of `curl`):

```
curl http://localhost:8765/api/health
curl http://localhost:8765/api/status
```

`/api/status` should show each source with a recent `lastSuccess` and `error: null`. Logs: `data/service.log`.

## 6. Keep it running

### Windows

Simplest: Task Scheduler.

1. Create Task > General: name "RFQ service", "Run whether user is logged on or not", "Run with highest privileges" off.
2. Triggers: **At startup**.
3. Actions: Start a program = `start.cmd` in the project folder (full path), and Start in = the project folder. (`start.cmd` restarts the service 10 seconds after it exits. It needs `node` on the PATH of the account the task runs as: test with `where node` in a fresh PowerShell. After saving the task, right-click it > Run, then check `curl http://localhost:8765/api/health`. To stop the service, End the task in Task Scheduler; ending only `node.exe` makes `start.cmd` start it again.)
4. Settings: untick "Stop the task if it runs longer than". In Conditions, untick "Start the task only if the computer is on AC power" so it also starts on battery.

The service notices a wake by timer drift (a sleeping machine freezes it), so no wake trigger is needed in Task Scheduler. After a wake that finds a refresh due, it waits `WAKE_DELAY_SEC` for the network, then refreshes; `data/service.log` shows `woke after ...` lines.

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

- **Freshness**: check `/api/status` (or `/api/health`'s `lastSuccessfulRefresh`); it should never be much over 24 hours old while the machine is awake; if it is, something is wrong. (A machine that sleeps for days is stale until it wakes, then refreshes.)
- **Back up** `data/state.json` and `ai-cache.json`. The data itself rebuilds on the next refresh, but losing `state.json` resets the `seq` cursor, and losing `ai-cache.json` makes every notice be re-read and re-billed.
- **Cost**: after the first run, check Anthropic Console > Usage; each run also appends to `ai-usage.log`. The account auto-reloads $20 when the balance reaches $5 (about $15 of use per reload, roughly every 3 to 8 months; see `anthropic-key-setup.md`). Keep the card on the account valid.
- **Key leaks**: delete the key on its service's site, make a new one, edit `.env`, restart the service.
- **Manual refresh**: `POST /api/refresh`, or restart the service.
- **Upgrading to a new version**:
  1. Stop the service (Windows: End the task in Task Scheduler; Linux: `sudo systemctl stop rfq-service`).
  2. Extract the new zip to a temporary folder, not over the project folder.
  3. Copy its files into the project folder, replacing existing files, but **do not overwrite or delete** these: `.env`, the `data/` folder (`state.json` and `service.log`), and `ai-cache.json` and `ai-usage.log` in the project folder itself. If the new zip contains any of them, skip them.
  4. Start the service again and check `/api/health` and `/api/status`.

## 8. The human page

`http://localhost:8765/` on the service machine itself still serves the table page (`index.html`). The page has no bid statuses and stores nothing, so it is a read-only view of the same data.

## 9. Optional: letting another machine read the feed

Skip this unless another machine really needs the JSON. By default the service answers this machine only (it binds to `127.0.0.1` even if `HOST` is not set).

1. In `.env`, change `HOST` (`0.0.0.0` listens on every network interface; or use this machine's own address to listen on one):

   ```
   HOST=0.0.0.0
   ```

2. Allow inbound TCP on port 8765 from the other machine only (Windows Defender Firewall > Inbound Rules, or `sudo ufw allow from <other-machine-ip> to any port 8765`).
3. Restart the service and test from the other machine: `curl http://<this-machine>:8765/api/status`.

The API has no authentication, so anyone who can reach the port can read the feed and `POST /api/refresh`. Keep the firewall rule narrow. The table page (section 8) still opens on this machine only. The service is plain HTTP.

## 10. Not built yet

- NYS Contract Reporter (no source; see spec section 3).
- HTTPS.
