# Google Forms: Add a question — MCP tool

**Google Forms MCP tool:** Adds a question to the form (a convenience wrapper over batchUpdate createItem).

Technical name: `add_question`

## What task it solves

> I want to add a question.

Adds a question to the form (a convenience wrapper over batchUpdate createItem).

## When to use it

Use this capability when you need “Add a question” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `title` — **required**. The question text shown to respondents.
- `type` — **required**. The question type.
- `description` — **optional**. Help text shown under the question.
- `required` — **optional**. Whether an answer is required to submit.
- `index` — **optional**. 0-based position to insert at; omitted = append after the last item.
- `options` — **optional**. The choices — required for radio, checkbox and dropdown.
- `shuffle` — **optional**. Shuffle option order per respondent (choice types).
- `low` — **optional**. Scale lower bound (default 1; scale type).
- `high` — **optional**. Scale upper bound (default 5; scale type).
- `low_label` — **optional**. Label for the lowest scale point.
- `high_label` — **optional**. Label for the highest scale point.
- `include_time` — **optional**. Date question also asks for a time of day.
- `include_year` — **optional**. Date question includes the year.
- `duration` — **optional**. Time question asks for an elapsed duration instead of a time of day.
- `rating_scale_level` — **optional**. Number of rating icons (3..10; default 5; rating type).
- `rating_icon_type` — **optional**. Rating icon (default star).

## What it returns

Returns the created itemId and questionId from the batchUpdate replies.

## What changes in Google Forms

The tool changes real Google Forms data as described above. The server does not promise an automatic rollback.

## Example request

> Add a question in Google Forms. Ask for any required identifiers that are missing.

## Errors and limitations

Types: text (short answer), paragraph (long answer), radio (single choice), checkbox (multiple choice), dropdown, scale (linear scale low..high), date, time, rating (stars/hearts/thumbs). Choice types require options[]. index inserts at that 0-based position; omit it to append at the end (costs one extra read to count items). Quiz grading (points, correct answers, feedback) cannot be set here — after adding, use update_question with the questionItem.question.grading mask. File-upload questions cannot be created via the API, and question grids (questionGroupItem) need raw_request with a batchUpdate body.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Delete an item](./delete-item.md) — `delete_item`
- [Move an item](./move-item.md) — `move_item`
- [Update an item](./update-question.md) — `update_question`

## Technical details

- **Impact:** changes data
- **Group:** Items and questions
- **Description source:** `add_question` registration in `src/tools/items.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
