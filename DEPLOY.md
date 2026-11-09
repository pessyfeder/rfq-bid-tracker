# Installing the RFQ Bid Tracker on Israel's server

Status: this covers what exists today (the page plus the three data fetchers and their API keys). The multi-user parts (login, shared statuses, database, HTTPS web server) are not built yet; section 6 lists them. Update this file as they land.

No secrets belong in this file or anywhere in the project. Keys are typed on the server itself (section 3).

## 0. What you need to know first

- **The project does not carry its data or keys.** `live-*.js` (the bid data) and `ai-usage.log` / `ai-cache.json` are git-ignored, and environment variables are not part of any copy. On the new server you must run the fetchers once to generate the data, and enter the keys there.
- The server has its own environment, separate from the computer where the app was built. A key set on the build computer is not on the server.

## 1. Prerequisites on the server

- Node.js, recent LTS (check with `node --version`).
- Git (or another way to copy the project folder).
- Outbound internet access to sam.gov, data.cityofnewyork.us, and api.anthropic.com.
- Know which operating system it is: Linux steps are in 3a/4a, Windows in 3b/4b.

## 2. Get the project onto the server

```bash
git clone <repo-url> /opt/rfq-bid-tracker
cd /opt/rfq-bid-tracker
```

(On Windows, clone to a folder such as `C:\rfq-bid-tracker`.) There are no npm dependencies today, so no install step is needed.

## 3. Put the keys on the server

Two keys. Create them in each service's own site (see `anthropic-key-setup.md` for the Anthropic one; SAM.gov > Account Details > API Key for the other). Make a **new** Anthropic key for the server; do not reuse the one from the build computer.

### 3a. Linux

Create the env file (root only):

```bash
sudo install -m 600 -o root -g root /dev/null /etc/rfq-bid-tracker.env
sudo nano /etc/rfq-bid-tracker.env
```

Put exactly these two lines in it, with the real values:

```
SAM_API_KEY=your-sam-key
ANTHROPIC_API_KEY=sk-ant-your-key
```

### 3b. Windows

Open System Properties > Environment Variables and add `SAM_API_KEY` and `ANTHROPIC_API_KEY` as **system** variables. Open a new terminal afterwards so they are picked up.

## 4. Test by hand, then schedule

### 4a. Linux

Load the keys into one shell and run each fetcher once:

```bash
cd /opt/rfq-bid-tracker
set -a; . /etc/rfq-bid-tracker.env; set +a
node fetch-nyc.js
node fetch-sam.js
node fetch-ny-state.js
```

Success looks like "Wrote N ... solicitations" lines and **no** "ANTHROPIC_API_KEY not set" or "SAM_API_KEY is not set" message. Then check the new `live-*.js` files exist.

Schedule it nightly with a systemd service and timer.

`/etc/systemd/system/rfq-fetch.service`:

```
[Unit]
Description=RFQ Bid Tracker nightly data refresh

[Service]
Type=oneshot
WorkingDirectory=/opt/rfq-bid-tracker
EnvironmentFile=/etc/rfq-bid-tracker.env
ExecStart=/bin/sh -c "node fetch-nyc.js && node fetch-sam.js && node fetch-ny-state.js"
```

`/etc/systemd/system/rfq-fetch.timer`:

```
[Unit]
Description=Run RFQ fetch nightly

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and test it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rfq-fetch.timer
sudo systemctl start rfq-fetch.service      # run once now
journalctl -u rfq-fetch.service -n 50        # read the output
```

`EnvironmentFile=` is the line that hands the keys to the scripts. Without it the scheduled job has no keys, even though a manual run works.

For safety, run the service as a dedicated low-privilege user (add `User=rfq` to the service) once the basics work.

### 4b. Windows

Run each script once in a new terminal and check the same success signs as above:

```powershell
cd C:\rfq-bid-tracker
node fetch-nyc.js; node fetch-sam.js; node fetch-ny-state.js
```

Then create a Task Scheduler task: trigger daily at 02:00, action `node` with arguments `fetch-nyc.js` (and one task each for the other two, or a small `.cmd` file that runs all three), "Start in" set to `C:\rfq-bid-tracker`. Run it as an account that can see the system environment variables.

## 5. Check it and look after it

- After the first nightly run, open the Anthropic Console > Usage to see what a refresh costs (the spec estimates about 200 small-model calls per NYC refresh).
- If the AI columns show "No data", the Anthropic key was not seen by the job. Re-check section 3 and the `EnvironmentFile=` line.
- If a key leaks: delete it in its service's site, create a new one, and replace it in the env file or system variable.
- Back up the project folder (or just anything you add later, like the database) on a regular schedule.

## 6. Not built yet (needed for multiple users)

This install only refreshes the data. For several people with logins, the following still need to be built, in this order:

1. A small Node server (static page plus a statuses API) and a SQLite database, so statuses are shared instead of stored per-browser.
2. Username/password login with an admin who creates accounts.
3. A web server in front (Caddy or nginx) giving HTTPS, on a subdomain. If the server already has a web server, add a reverse proxy rule instead of installing a second one.
4. The company profile (`company-profile.json`, currently empty: `holds: null`) editable in the app, **by admins only** (normal users see the eligibility results but cannot change the profile). Needs Israel's real list. Until the server exists, edit the file by hand and copy its list into `COMPANY.holds` in `data.js`.
5. Run the new server as a service (systemd, or a Windows service via NSSM/pm2) and add the database file to backups.

Until those exist, anyone opening `index.html` sees the data but keeps their own statuses in their own browser only.
