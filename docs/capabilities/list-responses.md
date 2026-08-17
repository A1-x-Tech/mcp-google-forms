# Google Forms: List form responses — MCP tool

**Google Forms MCP tool:** Lists submitted responses: responseId, createTime, lastSubmittedTime, respondentEmail (only when email collection is on), answers keyed by questionId (map questionId → question via get_form), and totalScore for graded quizzes.

Technical name: `list_responses`

## What task it solves

> I want to list form responses.

Lists submitted responses: responseId, createTime, lastSubmittedTime, respondentEmail (only when email collection is on), answers keyed by questionId (map questionId → question via get_form), and totalScore for graded quizzes.

## When to use it

Use this capability when you need “List form responses” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `submitted_after` — **optional**. Only responses submitted after this RFC3339 UTC timestamp, e.g. 2026-08-01T00:00:00Z (exclusive).
- `page_size` — **optional**. Max responses per page (1..5000; the API's default and max is 5000).
- `page_token` — **optional**. nextPageToken from the previous page.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The tool reads Google Forms data and does not change it.

## Example request

> List form responses in Google Forms. Ask for any required identifiers that are missing.

## Errors and limitations

submitted_after keeps only responses submitted strictly after that RFC3339 UTC timestamp — the API's only filter; there is no ordering or email filter, do that client-side. Paginate with page_token from nextPageToken. Note: this endpoint has a lower per-minute quota than other reads — poll incrementally with submitted_after rather than re-listing everything. The API is read-only for responses; submitting them programmatically is impossible.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get one response](./get-response.md) — `get_response`

## Technical details

- **Impact:** read-only
- **Group:** Responses
- **Description source:** `list_responses` registration in `src/tools/responses.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
