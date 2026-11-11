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

Background jobs (systemd, Windows Task Scheduler) do not inherit a login shell's variables, so set it where the job runs:

- **Linux (systemd):** create `/etc/rfq-bid-tracker.env` containing the line `ANTHROPIC_API_KEY=sk-ant-...`, owned by root with `chmod 600`, and load it with `EnvironmentFile=/etc/rfq-bid-tracker.env` in the service unit.
- **Windows:** set it as a system environment variable (System Properties > Environment Variables) or in the scheduled task's environment, then restart the task or service.

The same applies to `SAM_API_KEY` (the free SAM.gov key from SAM.gov > Account Details > API Key).

## Part 5: Check it and look after it

- Run one fetch by hand (for example `node fetch-nyc.js`) and confirm it does not print "ANTHROPIC_API_KEY not set".
- Check **Usage** in the Console after the first few runs to see what a refresh costs (the spec estimates about 200 small-model calls per NYC refresh).
- If the key may have leaked, delete it in the Console right away and create a new one.
