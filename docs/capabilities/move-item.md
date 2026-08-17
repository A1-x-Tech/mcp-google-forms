# Google Forms: Move an item — MCP tool

**Google Forms MCP tool:** Moves the item at from_index to to_index (both 0-based, to_index is the position after removal).

Technical name: `move_item`

## What task it solves

> I want to move an item.

Moves the item at from_index to to_index (both 0-based, to_index is the position after removal).

## When to use it

Use this capability when you need “Move an item” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `from_index` — **required**. Current 0-based position of the item.
- `to_index` — **required**. Target 0-based position.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The tool changes real Google Forms data as described above. The server does not promise an automatic rollback.

## Example request

> Move an item in Google Forms. Ask for any required identifiers that are missing.

## Errors and limitations

Use get_form to see the current order first.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a question](./add-question.md) — `add_question`
- [Delete an item](./delete-item.md) — `delete_item`
- [Update an item](./update-question.md) — `update_question`

## Technical details

- **Impact:** changes data
- **Group:** Items and questions
- **Description source:** `move_item` registration in `src/tools/items.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
