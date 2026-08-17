# Google Forms: Publish or unpublish a form — MCP tool

**Google Forms MCP tool:** Publishes or unpublishes the form and opens/closes response collection.

Technical name: `set_publish_settings`

## What task it solves

> I want to change a form's publishing state.

Publishes or unpublishes the form and opens/closes response collection.

## When to use it

Use this capability when you need “Publish or unpublish a form” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `is_published` — **required**. true = published (respondents can open it), false = unpublished draft.
- `is_accepting_responses` — **optional**. Whether the form accepts new responses (defaults to the value of is_published).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The source marks the entire “Publish or unpublish a form” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Publish or unpublish a form in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

is_accepting_responses defaults to mirroring is_published (publish = start accepting, unpublish = stop). Use is_published=true with is_accepting_responses=false to keep a published form visible but closed. Fails on legacy forms created before the publish model existed — those are managed only in the Forms UI.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a form](./create-form.md) — `create_form`
- [Get a form](./get-form.md) — `get_form`
- [Update form info](./update-form-info.md) — `update_form_info`
- [Update form settings](./update-form-settings.md) — `update_form_settings`

## Technical details

- **Impact:** destructive operation
- **Group:** Forms
- **Description source:** `set_publish_settings` registration in `src/tools/forms.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
