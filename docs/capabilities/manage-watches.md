# Google Forms: Manage push-notification watches — MCP tool

**Google Forms MCP tool:** Manages Cloud Pub/Sub push-notification watches on a form.

Technical name: `manage_watches`

## What task it solves

> I want to manage push-notification watches.

Manages Cloud Pub/Sub push-notification watches on a form.

## When to use it

Use this capability when you need “Manage push-notification watches” without doing the same work manually in the Google Forms interface. It runs only when an AI client calls it.

## What to provide

- `form_id` — **required**. The form id — the long id from the form URL (docs.google.com/forms/d/<formId>/edit) or from create_form output.
- `action` — **required**. What to do with the form's watches.
- `event_type` — **optional**. create only: RESPONSES (new submissions) or SCHEMA (form structure/settings changes).
- `topic_name` — **optional**. create only: the Cloud Pub/Sub topic, e.g. projects/my-project/topics/forms-events.
- `watch_id` — **optional**. delete/renew: the watch to target. create: optional custom id (auto-generated if omitted).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Forms

The source marks the entire “Manage push-notification watches” call as destructive. The exact effect depends on the selected action and is described below; review the parameters and reversibility before calling it.

## Example request

> Manage push-notification watches in Google Forms. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

action=create needs event_type (RESPONSES = new submissions, SCHEMA = form structure changes) and topic_name; the topic must live in your Cloud project and grant the Pub/Sub Publisher role to forms-notifications@system.gserviceaccount.com. action=list shows your watches; delete and renew need watch_id. Watches expire after 7 days — renew extends 7 days from now and reactivates a SUSPENDED watch. Notifications carry only formId/watchId/eventType attributes (no payload): on RESPONSES call list_responses with submitted_after, on SCHEMA call get_form. Limits: 1 watch per user per form+event type, 20 per Cloud project.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

There are no other dedicated tools in this group.

## Technical details

- **Impact:** destructive operation
- **Group:** Watches
- **Description source:** `manage_watches` registration in `src/tools/watches.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
