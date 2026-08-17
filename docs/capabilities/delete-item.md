# Google Forms: Delete an item — MCP tool

**Google Forms MCP tool:** Deletes the item at the given 0-based index (question, page break, text block, ...).

Technical name: `delete_item`

## What task it solves

> I want to delete an item.

Deletes the item at the given 0-based index (question, page break, text block, ...).

## When to use it

Use this capability when you need “Delete an item” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `index` — **required**. 0-based position of the item to delete (from get_form).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The source marks the entire “Delete an item” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Delete an item in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Deletion shifts every later item one position down — re-check indexes with get_form between successive deletes.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a question](./add-question.md) — `add_question`
- [Move an item](./move-item.md) — `move_item`
- [Update an item](./update-question.md) — `update_question`

## Technical details

- **Impact:** destructive operation
- **Group:** Items and questions
- **Description source:** `delete_item` registration in `src/tools/items.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
