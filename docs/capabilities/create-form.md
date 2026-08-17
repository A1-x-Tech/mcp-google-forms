# Google Forms: Create a form — MCP tool

**Google Forms MCP tool:** Creates a new Google Form and returns it (formId, revisionId, responderUri, publishSettings).

Technical name: `create_form`

## What task it solves

> I want to create a form.

Creates a new Google Form and returns it (formId, revisionId, responderUri, publishSettings).

## When to use it

Use this capability when you need “Create a form” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `title` — **required**. The form title shown to respondents.
- `document_title` — **optional**. The document name in Google Drive (defaults to the title).
- `publish` — **optional**. Publish the form right away so it accepts responses (default false — the form stays an unpublished draft).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The tool changes real Google Forms data as described above. The server does not promise an automatic rollback.

## Example request

> Create a form in Google Forms. Ask for any required identifiers that are missing.

## Errors and limitations

The API only accepts a title and an optional document title at creation (the Drive file name — it cannot be changed later through this API) — add questions with add_question and change settings with update_form_settings afterwards. IMPORTANT: API-created forms are UNPUBLISHED by default and do not accept responses; pass publish=true to publish immediately, or call set_publish_settings later. If the chained publish step fails, the form still exists: the result carries formId with published:false and publish_error — finish with set_publish_settings, never create_form again. Share the responderUri with respondents once published.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get a form](./get-form.md) — `get_form`
- [Publish or unpublish a form](./set-publish-settings.md) — `set_publish_settings`
- [Update form info](./update-form-info.md) — `update_form_info`
- [Update form settings](./update-form-settings.md) — `update_form_settings`

## Technical details

- **Impact:** changes data
- **Group:** Forms
- **Description source:** `create_form` registration in `src/tools/forms.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
