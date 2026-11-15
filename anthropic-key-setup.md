# Setting up the Anthropic API key (for Israel's server)

Purpose: the app's fetch scripts use Claude to read each bid notice (what a bidder must hold, scope, key points, stated dollar amounts). That needs an Anthropic API key. Usage is billed per call to the account that owns the key, separately from any Claude chat subscription (claude.ai).

**Rule: the key itself never goes in this repo, in chat, or in email.** This document contains steps only, no secrets.

The Console's menus change from time to time. Look for the section names (Billing, Limits, Members, API Keys) if the exact wording differs.

## Part 1: Israel creates the account (about 10 minutes)

Israel should own the account so the bill goes to him and he controls access.

1. Go to https://console.anthropic.com and sign up or sign in. This is separate from claude.ai; a chat subscription does not include API access.
2. Create or confirm an **organization**. Name it for the company (for example "Discover Group").
3. Go to **Settings > Billing**. Add a payment method and buy a small amount of prepaid credit (for example $10 to $20). Calls fail when credit runs out.
4. Go to **Settings > Limits** (or the spend-limit section of Billing). Set a **monthly spend limit** so a bug or a leaked key cannot run up a large bill.

## Current billing arrangement and runway (as of 2026-11-11)

- The account is on a **$20 prepaid plan with auto-reload**: when the balance falls to **$5**, the card is charged $20 and the balance goes back up. Calls only fail if the reload is declined (card expired, bank block) or the monthly spend limit is hit, so keep the card current and the limit above expected use.
- The key for this app is in the local `.env` (git-ignored; never commit or paste it).
- **Each reload buys about $15 of use** (the $5 floor is never spent down first), so a reload happens whenever $15 has been consumed.
- **Estimated time between reloads: about 3 to 8 months** in normal running. Basis: the spec projects roughly $1 to $3 a month once the cache is warm; I'd budget $2 to $5 a month to allow for the state portals and new notices. At $2/month a reload is about every 7 months; at $5/month, about every 3 months. That is roughly $40 to $80 a year.
- **Caveat:** this is a projection. During development (2026-11-10 to 11-11) `ai-usage.log` shows about $10.40 of *estimated* spend in two days, because the cache was cleared and prompts changed repeatedly. The first $15 may go much sooner if development continues. After the cache is warm, check `ai-usage.log` (or the Console Usage page) after a week of scheduled runs and replace the estimate with the measured daily average: months between reloads = 15 / (daily cost x 30).
- Reloads appear as $20 charges on the card and in Console > Billing. A reload sooner than every ~2 months means something is re-reading notices (a deleted `ai-cache.json`, or a changed prompt) and is worth investigating.

## Part 2: Israel adds Pessy as a member

1. Go to **Settings > Members** (sometimes "Organization" or "Team").
2. Choose **Invite**, enter Pessy's email address, and pick a role that can manage API keys (Developer or Admin; Admin is needed to manage billing and members).
3. Pessy accepts the invitation from the email, signs in to the Console, and switches to Israel's organization (organization switcher, top left).

Israel can remove Pessy's access at any time from the same page.

## Part 3: Create the key

Either person can do this once they are inside Israel's organization.

1. Go to **Settings > API Keys > Create Key**.
2. Name it for the deployment, for example `rfq-bid-tracker-server`. Use a different key for local testing so either can be revoked without breaking the other.
3. **Copy the key immediately.** It starts with `sk-ant-` and is shown only once. If it is lost, delete it and create a new one.
4. Put it straight into a password manager, or directly into the server's environment (Part 4). Do not paste it into chat, email, a text file in the project, or git.

## Part 4: Install it on the server (do this at installation time)

The scripts read the key from the environment variable `ANTHROPIC_API_KEY` (see `fetch-nyc.js`, `fetch-sam.js`, `ai-extract.js`). If it is not set they skip the AI step and the app still works with basic values.

Background jobs (systemd, services) do not inherit a login shell's variables, so set it where the job runs:

- **Linux (systemd):** create `/etc/rfq-bid-tracker.env` containing the line `ANTHROPIC_API_KEY=sk-ant-...`, owned by root with `chmod 600`, and load it with `EnvironmentFile=/etc/rfq-bid-tracker.env` in the service unit.
- **Windows:** set it as a system environment variable (System Properties > Environment Variables) then restart the service.

The same applies to `SAM_API_KEY` (the free SAM.gov key from SAM.gov > Account Details > API Key).

## Part 5: Check it and look after it

- Run one fetch by hand (for example `node fetch-nyc.js`) and confirm it does not print "ANTHROPIC_API_KEY not set".
- Check **Usage** in the Console after the first few runs to see what a refresh costs (the spec estimates about 200 small-model calls per NYC refresh).
- If the key may have leaked, delete it in the Console right away and create a new one.
