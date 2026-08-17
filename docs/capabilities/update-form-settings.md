# Google Forms: Update form settings — MCP tool

**Google Forms MCP tool:** Toggles quiz mode (grading with points) and/or the email collection mode.

Technical name: `update_form_settings`

## What task it solves

> I want to update form settings.

Toggles quiz mode (grading with points) and/or the email collection mode.

## When to use it

Use this capability when you need “Update form settings” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `is_quiz` — **optional**. Turn quiz mode on/off (enables per-question grading).
- `email_collection_type` — **optional**. How respondent emails are collected.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The source marks the entire “Update form settings” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Update form settings in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Quiz mode only enables grading — points, correct answers and feedback are set per question afterwards via update_question with the questionItem.question.grading mask (add_question cannot set them). email_collection_type: DO_NOT_COLLECT, VERIFIED (respondent must be signed in; email verified) or RESPONDER_INPUT (respondent types an email). At least one field is required; only the provided fields are touched.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a form](./create-form.md) — `create_form`
- [Get a form](./get-form.md) — `get_form`
- [Publish or unpublish a form](./set-publish-settings.md) — `set_publish_settings`
- [Update form info](./update-form-info.md) — `update_form_info`

## Technical details

- **Impact:** destructive operation
- **Group:** Forms
- **Description source:** `update_form_settings` registration in `src/tools/forms.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
