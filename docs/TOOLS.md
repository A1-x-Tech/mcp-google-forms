# Tools

The Google Forms API mixes reads and writes, so every tool carries explicit MCP
annotations: reads are `readOnlyHint`, updates are idempotent-but-overwriting,
deletes are destructive. Inputs use a normalized snake_case vocabulary; the
client maps them to the API's wire values (`RADIO` / `DROP_DOWN` / `THUMB_UP`,
updateMask paths) and handles OAuth entirely on its own.

`form_id` is the long id from the form URL (`docs.google.com/forms/d/<formId>/edit`)
or from `create_form` output.

## Forms

| Tool | Description |
|---|---|
| `create_form` | Creates a form. The API accepts only `title` + `document_title` at creation — add questions and settings afterwards. **API-created forms start unpublished**; `publish: true` chains a `setPublishSettings` call so the form immediately accepts responses. If that publish call fails, the form is still returned with `published: false` and a `publish_error` — follow up with `set_publish_settings`, don't re-create. Returns `formId`, `responderUri`, `revisionId`, `publishSettings`. |
| `get_form` | Full form: info, settings, `items[]` (with `itemId`/`questionId` and 0-based positions), publish state, `responderUri`, `linkedSheetId`. Call it before mutating items — item tools address by index. |
| `update_form_info` | Changes `title` / `description`; the updateMask is computed from the provided fields (at least one required). The Drive file name (`document_title`) is set only at creation — renaming it later needs the Drive API, which this server doesn't cover. |
| `update_form_settings` | Toggles quiz mode (`is_quiz`) and/or email collection (`DO_NOT_COLLECT` / `VERIFIED` / `RESPONDER_INPUT`). Quiz mode only enables grading — set points/correct answers per question via `update_question` (`questionItem.question.grading`). |
| `set_publish_settings` | Publishes/unpublishes and opens/closes response collection. `is_accepting_responses` defaults to mirroring `is_published`. Fails on legacy forms (they predate the publish model). |

## Items & questions

| Tool | Description |
|---|---|
| `add_question` | Convenience wrapper over `batchUpdate createItem`. Types: `text`, `paragraph`, `radio`, `checkbox`, `dropdown` (need `options[]`), `scale` (`low`/`high`/labels), `date` (`include_time`/`include_year`), `time` (`duration`), `rating` (`rating_scale_level`, `rating_icon_type`). `index` inserts at a position; omitted = append (costs one extra read to count items). Quiz grading cannot be set here — use `update_question` (`questionItem.question.grading`). File-upload questions cannot be created via the API; grids (`questionGroupItem`) go through `raw_request`. |
| `update_question` | `batchUpdate updateItem`: raw Item object + explicit `update_mask` (e.g. `title,questionItem.question.required`). Only masked fields change. |
| `delete_item` | Deletes the item at a 0-based index. Later items shift down — re-check indexes between successive deletes. |
| `move_item` | Moves an item `from_index` → `to_index`. |

## Responses (read-only)

| Tool | Description |
|---|---|
| `list_responses` | Lists submissions with `answers` keyed by `questionId`. `submitted_after` (RFC3339 UTC) is the API's **only** filter (`timestamp >`); no ordering or email filters exist — do that client-side. Paginate via `page_token`; `page_size` ≤ 5000. Counted against a lower "expensive read" quota — poll incrementally. |
| `get_response` | One submission by `response_id`. `respondentEmail` and `totalScore` are present only when email collection / quiz grading are enabled. |

The API **cannot submit responses** — there is no such endpoint and no such tool.

## Watches

| Tool | Description |
|---|---|
| `manage_watches` | `action`: `create` (needs `event_type` `RESPONSES`\|`SCHEMA` + `topic_name`), `list`, `delete`, `renew` (need `watch_id`). The Pub/Sub topic must be in your Cloud project and grant Publisher to `forms-notifications@system.gserviceaccount.com`. Watches expire after 7 days; `renew` extends and reactivates `SUSPENDED` watches. Notifications carry only attributes (formId/watchId/eventType) — fetch the data with `get_form` / `list_responses`. Limits: 1 watch per user per form+event type, 20 per project. |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | Calls any Forms API v1 path directly (`GET`/`POST`/`DELETE`, default GET) — e.g. a `batchUpdate` with `questionGroupItem` grids, `writeControl.requiredRevisionId` or several requests at once. The path may carry a query string. A path resolving to a foreign origin is rejected (SSRF guard), so the Bearer token never leaves `forms.googleapis.com`. |

## Notes

- **Retry policy:** 429 is retried with backoff for every method (the request was rejected
  before executing); 5xx and network errors are retried **only for GET** — replaying a write
  after an ambiguous failure could duplicate it.
- **OAuth:** access tokens are minted from the refresh token automatically, cached until ~60s
  before expiry, and re-minted once on a 401.
- **Item addressing is positional** (`location.index`), not by `itemId` — that is the API's
  contract for `updateItem`/`deleteItem`/`moveItem`.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_FORMS_CLIENT_ID` | yes* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_FORMS_CLIENT_SECRET` | yes* | — | OAuth2 client secret (refresh flow). Secret. |
| `GOOGLE_FORMS_REFRESH_TOKEN` | yes* | — | OAuth2 refresh token (refresh flow). Secret. |
| `GOOGLE_FORMS_ACCESS_TOKEN` | yes* | — | Alternative: static access token (~1 h lifetime). Secret. |
| `GOOGLE_FORMS_API_BASE` | no | `https://forms.googleapis.com` | API root override. |
| `GOOGLE_FORMS_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_FORMS_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* Either the refresh triple together, or the static access token.
