# Google Forms MCP capabilities

This catalog contains 13 public pages—one for every registered MCP tool in `mcp-google-forms`. Each page starts with the user's task, explains the result, and states whether the call changes real data.

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Items and questions

- [Add a question](./add-question.md) — Adds a question to the form (a convenience wrapper over batchUpdate createItem). **Impact:** changes data.
- [Delete an item](./delete-item.md) — Deletes the item at the given 0-based index (question, page break, text block, ...). **Impact:** destructive operation.
- [Move an item](./move-item.md) — Moves the item at from_index to to_index (both 0-based, to_index is the position after removal). **Impact:** changes data.
- [Update an item](./update-question.md) — Updates an existing item (question or other) via batchUpdate updateItem. **Impact:** destructive operation.

## Forms

- [Create a form](./create-form.md) — Creates a new Google Form and returns it (formId, revisionId, responderUri, publishSettings). **Impact:** changes data.
- [Get a form](./get-form.md) — Returns the full form: info (title, description), settings (quiz mode, email collection), items[] with their itemId/questionId and question definitions, publishSettings, responderUri and linkedSheetId. **Impact:** read-only.
- [Publish or unpublish a form](./set-publish-settings.md) — Publishes or unpublishes the form and opens/closes response collection. **Impact:** destructive operation.
- [Update form info](./update-form-info.md) — Changes the form's title and/or description. **Impact:** destructive operation.
- [Update form settings](./update-form-settings.md) — Toggles quiz mode (grading with points) and/or the email collection mode. **Impact:** destructive operation.

## Responses

- [Get one response](./get-response.md) — Fetches a single submission by its responseId (from list_responses): answers keyed by questionId, createTime, lastSubmittedTime, respondentEmail and totalScore when available. **Impact:** read-only.
- [List form responses](./list-responses.md) — Lists submitted responses: responseId, createTime, lastSubmittedTime, respondentEmail (only when email collection is on), answers keyed by questionId (map questionId → question via get_form), and totalScore for graded quizzes. **Impact:** read-only.

## Watches

- [Manage push-notification watches](./manage-watches.md) — Manages Cloud Pub/Sub push-notification watches on a form. **Impact:** destructive operation.

## Additional API methods

- [Raw Google Forms API call](./raw-request.md) — Escape hatch to call any Google Forms API v1 path directly, for requests the typed tools don't cover — e.g. **Impact:** destructive operation.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-forms)
