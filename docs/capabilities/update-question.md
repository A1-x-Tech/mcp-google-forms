# Google Forms: Update an item — MCP tool

**Google Forms MCP tool:** Updates an existing item (question or other) via batchUpdate updateItem.

Technical name: `update_question`

## What task it solves

> I want to update an item.

Updates an existing item (question or other) via batchUpdate updateItem.

## When to use it

Use this capability when you need “Update an item” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `index` — **required**. 0-based position of the item to update (from get_form).
- `item` — **required**. The Forms API Item object with the new values, e.g. {"title":"New title","questionItem":{"question":{"required":true}}}.
- `update_mask` — **required**. Comma-separated field paths to replace, e.g. "title,questionItem.question.required".

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The source marks the entire “Update an item” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Update an item in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

The item is addressed by its 0-based index — call get_form first to see current positions and the item's current shape. item is a raw Forms API Item object with the new values; update_mask names the fields to replace, e.g. "title" or "title,questionItem.question.required". Only masked fields change; masking a field the item object leaves unset clears it.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a question](./add-question.md) — `add_question`
- [Delete an item](./delete-item.md) — `delete_item`
- [Move an item](./move-item.md) — `move_item`

## Technical details

- **Impact:** destructive operation
- **Group:** Items and questions
- **Description source:** `update_question` registration in `src/tools/items.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
