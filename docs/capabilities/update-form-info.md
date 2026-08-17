# Google Forms: Update form info — MCP tool

**Google Forms MCP tool:** Changes the form's title and/or description.

Technical name: `update_form_info`

## What task it solves

> I want to update form info.

Changes the form's title and/or description.

## When to use it

Use this capability when you need “Update form info” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `title` — **optional**. New form title shown to respondents.
- `description` — **optional**. New form description shown under the title.

## What it returns

Returns the batchUpdate replies with the new revisionId.

## What changes in Google Forms

The source marks the entire “Update form info” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Update form info in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Only the provided fields are touched (the updateMask is computed automatically); at least one field is required. The document title (the Drive file name) is set once at create_form and cannot be changed through the Forms API — renaming the file needs the Drive API, which this server does not cover.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a form](./create-form.md) — `create_form`
- [Get a form](./get-form.md) — `get_form`
- [Publish or unpublish a form](./set-publish-settings.md) — `set_publish_settings`
- [Update form settings](./update-form-settings.md) — `update_form_settings`

## Technical details

- **Impact:** destructive operation
- **Group:** Forms
- **Description source:** `update_form_info` registration in `src/tools/forms.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
