# RFQ feed API (for clients of the service)

The service (`server.js`) refreshes the data once per day, on the first check or wake after 5:00 local time (set `REFRESH_MORNING_HOUR` to change the hour), and serves it as JSON. On first install, when a source has never run, every fetcher runs at once. If a source is still failing after a refresh, it retries up to 3 more times, 20 minutes apart. This service does **not** judge eligibility (see spec 2a); it passes on what each request says it requires.

Base URL: `http://<service-machine>:8765` (port set by `PORT`). Schema version: **1**.

## Authentication

None. The data is not private. Traffic is plain HTTP. The service listens on `127.0.0.1` (this machine only) unless `HOST` is set (for example `HOST=0.0.0.0`) to open it to another machine.

**Sharing with another machine needs two settings, not one.** `HOST=0.0.0.0` only makes the service reachable. As a guard against DNS-rebinding attacks, the service also checks the request's `Host` header and answers `403` (`{"error": "unrecognized Host header (set ALLOWED_HOSTS to add this name)"}`) unless it is `localhost`, `127.0.0.1`, `[::1]`, or a name listed in `ALLOWED_HOSTS` (comma-separated, no port, case-insensitive). Set it to whatever name or address the other machine types in the URL, for example:

```
HOST=0.0.0.0 ALLOWED_HOSTS=my-pc,my-pc.local,192.168.1.20 node server.js
```

If the second machine gets that 403, the name in its URL is missing from `ALLOWED_HOSTS`.

## Endpoints

| Call | Purpose |
|---|---|
| `GET /api/health` | No auth. `{ok, lastSuccessfulRefresh, dataAsOf}` for uptime checks. Use `dataAsOf` to judge freshness (`lastSuccessfulRefresh` is the newest source, so it can hide a stale one). |
| `GET /api/status` | Per-source health: last fetch, last success, last error, record counts, `nextDueBy` (the next 5:00 after the last attempt; if already in the past, a refresh is due), `refreshing` (a refresh is running or about to start) and `stale` (a refresh is overdue but has not started). **Check this** to make sure the data is fresh. The human page polls it and shows a Refreshing banner. |
| `GET /api/rfqs` | The requests (see filters). |
| `GET /api/rfqs/{id}` | One request, including closed / dropped ones. `404` if the id is unknown. |
| `POST /api/refresh` | Start a refresh now. `202` started, `409` already running. Takes minutes; poll `/api/status` (`refreshing`). Loopback callers only (`403` otherwise, and cross-site browser requests are refused); set `REFRESH_TOKEN` to allow remote callers who send `Authorization: Bearer <token>` (`401` if wrong). |

A file snapshot of everything is also written after each refresh to `data/feed.json` (the full set, not truncated at the 5,000 `limit`; same record format as `/api/rfqs?open=0`), for a shared-folder hand-off instead of HTTP.

## Reading it: the incremental pattern (recommended)

Each record carries `seq`, a number that increases whenever the record is added or changes. The response carries `cursor`.

1. First run: `GET /api/rfqs` (loop while `more` is true, see below).
2. Store `cursor` from the last response.
3. Each poll: `GET /api/rfqs?after=<cursor>`. You get only new or changed records, **plus records that dropped out** (`active: false`). Store the new `cursor`.

If `more` is `true`, the page was cut off by `limit`; call again with `after=<cursor>` to continue exactly where it stopped. Records are returned in `seq` order. Reprocessing a record is safe: key on `id`.

`cursor` is not time-based, so a missed poll or a clock difference between machines loses nothing. If `latestSeq` in a response is *lower* than your stored cursor, the service's state was reset: do a full read.

## Filters on `/api/rfqs`

| Param | Meaning |
|---|---|
| `after=N` | Only records with `seq > N`; also includes `active:false` ones. Must be a number (`400` otherwise). |
| `limit=N` | Page size (default 1000, whole number from 1 to 5000; out-of-range values are clamped; not a number gives `400`). |
| `level=Federal\|State\|Local` | |
| `source=nyc\|sam\|states` | |
| `open=0` | Include requests whose deadline has passed (default: hidden). |
| `include_inactive=1` | Include records no longer in their source feed. |
| `real_deadline=1` | Only requests with a real deadline (drops placeholder dates). |
| `due_after=YYYY-MM-DD`, `due_before=YYYY-MM-DD` | Deadline window (Eastern date). |
| `min_value=N`, `max_value=N` | On `value.amount` (requests with no amount never match). |

## Response

```json
{
  "schemaVersion": 1, "generatedAt": "2026-11-09T19:44:17Z", "dataAsOf": "2026-11-09T19:30:02Z",
  "count": 100, "total": 298, "more": true, "cursor": 100, "latestSeq": 298,
  "rfqs": [ { ...record... } ]
}
```

**Freshness: use `dataAsOf`, not `generatedAt`.** `dataAsOf` is the *oldest* last successful fetch across the sources that should be running (`null` if one has never succeeded; sources skipped for a missing key are not counted). `generatedAt` is only when the feed was last rebuilt, which also happens on every service start, so it can look fresh when the data is a day old. `/api/status` has both, plus per-source `lastSuccess`.

## Record fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable, unique across sources (`NYC-…`, SAM notice id). |
| `seq` | int | Change counter (above). |
| `source` | `nyc` \| `sam` \| `states` | |
| `level` | `Federal` \| `State` \| `Local` | |
| `title`, `plainTitle`, `agency`, `category` | string | Category is City Record category, or `NAICS <code>` for SAM.gov. `plainTitle` is an AI-written plain-English headline of what is requested (or null). Plain text: never render as HTML. |
| `region` | string \| null | Place of performance / "New York City". |
| `posted` | `YYYY-MM-DD` | |
| `due` | `YYYY-MM-DD` | Eastern-time date. |
| `dueTime` | string \| null | As published, e.g. `3:30 PM EST`. Midnight and date-only deadlines (SAM.gov sometimes gives only a day) are treated as no time given: `null`, and the page shows "No time given". |
| `dueAt` | ISO UTC \| null | `due` + `dueTime` converted to an instant (null if no usable time). Use this to compare to "now". |
| `hasRealDeadline` | bool | `false` = placeholder (year 2099+ or over 3 years out). |
| `warnings` | string[] | e.g. "Posted over a year ago". The human page hides flagged rows by default. |
| `url` | string | Link to the solicitation. |
| `scope` | string | Plain-English summary ("" if unknown). AI-read when `aiRead`. |
| `requires` | string[] \| null | What an offeror must hold (`["Small business"]`, `["GSA Schedule"]`…). **`[]` = open to all. `null` = not read / unknown**: do not treat as open. |
| `restriction` | string \| null | Short restriction text. |
| `requirements` | string[] | Chips such as selection method, mandatory pre-bid. |
| `docAccess` | `read` \| `none` | `none` = the documents behind the posting were not read, so the record is only what the listing gives. The page shows a "Not checked" badge. |
| `sourceUrl` | string | Deep link to the source posting (same as `url`). |
| `naics`, `docDue` | string \| null | NAICS code and due date (YYYY-MM-DD) as stated in the documents, AI-read; null when not stated. |
| `shall` | `{text, ref}[]` | Key "shall" statements. |
| `amended` | bool | Currently never set by the feeds. |
| `aiRead` | bool | `scope`/`requires`/`shall` came from an AI read: verify before relying on them. |
| `value` | object | See below. |
| `active` | bool | `false` = no longer listed by its source (closed, withdrawn, or aged out). Treat as removed. |
| `firstSeen`, `lastSeen`, `updatedAt` | ISO UTC | Service-side timestamps. |

`value`: `{amount, basis, low, high, note}`. `basis` says how much to trust `amount`:

- `published`: the agency's own figure.
- `stated`: an amount quoted in the notice text (`note` is the quote; AI-read, verify).
- `none`: not published; `amount` is `null`.

## Notes for the filtering machine

- Without an Anthropic key on the service, `requires` is mostly `null` for NYC and `shall`/`scope` are thin. Filtering on eligibility works best with AI reading on.
- Honor `active:false` and `dueAt < now`: a request can disappear or close between polls.
- On a low SAM.gov request limit, `/api/status` shows for `sam`: `descriptionsWaiting` (requests listed with basic fields only so far, so `requires`/`scope`/`shall` are not read yet), `requestsUsedToday`, `dailyBudget`, and `searchComplete`. Treat a request with `requires: null` as unknown, not open.
- SAM.gov is fetched as "posted in the last 30 days". A SAM request that ages out of that window stays `active` until its own deadline passes, then goes `active:false`.
