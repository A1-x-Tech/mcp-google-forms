# Google Forms: Get a form — MCP tool

**Google Forms MCP tool:** Returns the full form: info (title, description), settings (quiz mode, email collection), items[] with their itemId/questionId and question definitions, publishSettings, responderUri and linkedSheetId.

Technical name: `get_form`

## What task it solves

> I want to get a form.

Returns the full form: info (title, description), settings (quiz mode, email collection), items[] with their itemId/questionId and question definitions, publishSettings, responderUri and linkedSheetId.

## When to use it

Use this capability when you need “Get a form” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.

## What it returns

Returns the full form: info (title, description), settings (quiz mode, email collection), items[] with their itemId/questionId and question definitions, publishSettings, responderUri and linkedSheetId.

## What changes in Google Forms

The tool reads Google Forms data and does not change it.

## Example request

> Get a form in Google Forms. Ask for any required identifiers that are missing.

## Errors and limitations

Items are returned in order — their 0-based positions are the indexes that update_question, delete_item and move_item address, so call this before mutating items.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a form](./create-form.md) — `create_form`
- [Publish or unpublish a form](./set-publish-settings.md) — `set_publish_settings`
- [Update form info](./update-form-info.md) — `update_form_info`
- [Update form settings](./update-form-settings.md) — `update_form_settings`

## Technical details

- **Impact:** read-only
- **Group:** Forms
- **Description source:** `get_form` registration in `src/tools/forms.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
