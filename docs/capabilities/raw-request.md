# Google Forms: Raw Google Forms API call — MCP tool

**Google Forms MCP tool:** Escape hatch to call any Google Forms API v1 path directly, for requests the typed tools don't cover — e.g.

Technical name: `raw_request`

## What task it solves

> I want to raw Google Forms API call.

Escape hatch to call any Google Forms API v1 path directly, for requests the typed tools don't cover — e.g.

## When to use it

Use this capability when you need “Raw Google Forms API call” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `path` — **required**. API path relative to https://forms.googleapis.com, e.g. "v1/forms/<formId>:batchUpdate".
- `method` — **optional**. HTTP method (the Forms API uses only these three). Defaults to GET.
- `body` — **optional**. JSON request body (POST only).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The source marks the entire “Raw Google Forms API call” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Raw Google Forms API call in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

a batchUpdate with questionGroupItem grids, writeControl/requiredRevisionId, includeFormInResponse, or several requests at once: path "v1/forms/<formId>:batchUpdate", method POST, body {"requests":[...]}. The path may carry a query string (e.g. "v1/forms/<id>/responses?filter=timestamp%20%3E%202026-08-01T00:00:00Z"). The Bearer token is added automatically; the method defaults to GET.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

There are no other dedicated tools in this group.

## Technical details

- **Impact:** destructive operation
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/raw.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
