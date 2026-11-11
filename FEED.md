# RFQ feed API (for clients of the service)

The service (`server.js`) refreshes the data on a schedule and serves it as JSON. This service does **not** judge eligibility (see spec 2a); it passes on what each request says it requires.

Base URL: `http://<service-machine>:8765` (port set by `PORT`). Schema version: **1**.

## Authentication

None. The data is not private. Traffic is plain HTTP. The service listens on `127.0.0.1` (this machine only) unless `HOST` is set; see DEPLOY.md section 9 to open it to another machine.

## Endpoints

| Call | Purpose |
|---|---|
| `GET /api/health` | No auth. `{ok, lastSuccessfulRefresh}` for uptime checks. |
| `GET /api/status` | Per-source health: last fetch, last success, last error, record counts, next scheduled run. **Check this** to make sure the data is fresh. |
| `GET /api/rfqs` | The requests (see filters). |
| `GET /api/rfqs/{id}` | One request, including closed / dropped ones. |
| `POST /api/refresh` | Start a refresh now. `202` started, `409` already running. Takes minutes; poll `/api/status` (`refreshing`). |

A file snapshot of everything is also written after each refresh to `data/feed.json` (same format as `/api/rfqs?open=0`), for a shared-folder hand-off instead of HTTP.

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
| `after=N` | Only records with `seq > N`; also includes `active:false` ones. |
| `limit=N` | Page size (default 1000, max 5000). |
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
  "schemaVersion": 1, "generatedAt": "2026-11-09T19:44:17Z",
  "count": 100, "total": 298, "more": true, "cursor": 100, "latestSeq": 298,
  "rfqs": [ { ...record... } ]
}
```

## Record fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable, unique across sources (`NYC-…`, SAM notice id). |
| `seq` | int | Change counter (above). |
| `source` | `nyc` \| `sam` \| `states` | |
| `level` | `Federal` \| `State` \| `Local` | |
| `title`, `agency`, `category` | string | Category is City Record category, or `NAICS <code>` for SAM.gov. Plain text: never render as HTML. |
| `region` | string \| null | Place of performance / "New York City". |
| `posted` | `YYYY-MM-DD` | |
| `due` | `YYYY-MM-DD` | Eastern-time date. |
| `dueTime` | string \| null | As published, e.g. `3:30 PM EST`. |
| `dueAt` | ISO UTC \| null | `due` + `dueTime` converted to an instant (null if no usable time). Use this to compare to "now". |
| `hasRealDeadline` | bool | `false` = placeholder (year 2099+ or over 3 years out). |
| `warnings` | string[] | e.g. "Posted over a year ago". The human page hides flagged rows by default. |
| `url` | string | Link to the solicitation. |
| `scope` | string | Plain-English summary ("" if unknown). AI-read when `aiRead`. |
| `requires` | string[] \| null | What an offeror must hold (`["Small business"]`, `["GSA Schedule"]`…). **`[]` = open to all. `null` = not read / unknown**: do not treat as open. |
| `restriction` | string \| null | Short restriction text. |
| `requirements` | string[] | Chips such as selection method, mandatory pre-bid. |
| `docAccess` | `read` \| `none` | `none` = the documents behind the posting were not read, so the record is only what the listing gives. The page shows a "No document access" badge. |
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
- `similar_awards`: median of similar past awards, with `low`/`high` = 25th/75th percentile. An estimate only.
- `none`: not published; `amount` is `null`.

## Notes for the filtering machine

- Without an Anthropic key on the service, `requires` is mostly `null` for NYC and `shall`/`scope` are thin. Filtering on eligibility works best with AI reading on.
- Honor `active:false` and `dueAt < now`: a request can disappear or close between polls.
- On a low SAM.gov request limit, `/api/status` shows for `sam`: `descriptionsWaiting` (requests listed with basic fields only so far, so `requires`/`scope`/`shall` are not read yet), `requestsUsedToday`, `dailyBudget`, and `searchComplete`. Treat a request with `requires: null` as unknown, not open.
- SAM.gov is fetched as "posted in the last 30 days". A SAM request that ages out of that window stays `active` until its own deadline passes, then goes `active:false`.
