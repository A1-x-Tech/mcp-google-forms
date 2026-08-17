# Google Forms: Get one response — MCP tool

**Google Forms MCP tool:** Fetches a single submission by its responseId (from list_responses): answers keyed by questionId, createTime, lastSubmittedTime, respondentEmail and totalScore when available.

Technical name: `get_response`

## What task it solves

> I want to get one response.

Fetches a single submission by its responseId (from list_responses): answers keyed by questionId, createTime, lastSubmittedTime, respondentEmail and totalScore when available.

## When to use it

Use this capability when you need “Get one response” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `response_id` — **required**. The response id from list_responses.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The tool reads Google Forms data and does not change it.

## Example request

> Get one response in Google Forms. Ask for any required identifiers that are missing.

## Errors and limitations

Map questionId to the question text via get_form.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List form responses](./list-responses.md) — `list_responses`

## Technical details

- **Impact:** read-only
- **Group:** Responses
- **Description source:** `get_response` registration in `src/tools/responses.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
