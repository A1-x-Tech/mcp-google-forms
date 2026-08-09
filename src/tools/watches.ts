import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleFormsClient } from "../client.js";
import { DESTRUCTIVE, fail, formIdSchema, ok } from "./util.js";

export function registerWatchTools(server: McpServer, client: GoogleFormsClient): void {
  server.registerTool(
    "manage_watches",
    {
      title: "Manage push-notification watches",
      // One tool covers create/list/delete/renew; delete removes state, so the
      // whole tool carries the destructive, non-idempotent hints.
      annotations: DESTRUCTIVE,
      description:
        "Manages Cloud Pub/Sub push-notification watches on a form. action=create needs event_type (RESPONSES = new submissions, SCHEMA = form structure changes) and topic_name; the topic must live in your Cloud project and grant the Pub/Sub Publisher role to forms-notifications@system.gserviceaccount.com. action=list shows your watches; delete and renew need watch_id. Watches expire after 7 days — renew extends 7 days from now and reactivates a SUSPENDED watch. Notifications carry only formId/watchId/eventType attributes (no payload): on RESPONSES call list_responses with submitted_after, on SCHEMA call get_form. Limits: 1 watch per user per form+event type, 20 per Cloud project.",
      inputSchema: {
        form_id: formIdSchema(),
        action: z.enum(["create", "list", "delete", "renew"]).describe("What to do with the form's watches."),
        event_type: z
          .enum(["RESPONSES", "SCHEMA"])
          .optional()
          .describe("create only: RESPONSES (new submissions) or SCHEMA (form structure/settings changes)."),
        topic_name: z
          .string()
          .regex(/^projects\/[^/]+\/topics\/[^/]+$/, "Must look like projects/<project>/topics/<topic>")
          .optional()
          .describe("create only: the Cloud Pub/Sub topic, e.g. projects/my-project/topics/forms-events."),
        watch_id: z
          .string()
          .regex(/^[a-z0-9-]{4,63}$/, "4-63 chars of [a-z0-9-]")
          .optional()
          .describe("delete/renew: the watch to target. create: optional custom id (auto-generated if omitted)."),
      },
    },
    async ({ form_id, action, event_type, topic_name, watch_id }) => {
      try {
        switch (action) {
          case "create":
            if (!event_type || !topic_name) {
              return fail(new Error('action "create" requires event_type and topic_name.'));
            }
            return ok(
              await client.createWatch({
                formId: form_id,
                eventType: event_type,
                topicName: topic_name,
                watchId: watch_id,
              }),
            );
          case "list":
            return ok(await client.listWatches(form_id));
          case "delete":
            if (!watch_id) return fail(new Error('action "delete" requires watch_id.'));
            return ok(await client.deleteWatch(form_id, watch_id));
          case "renew":
            if (!watch_id) return fail(new Error('action "renew" requires watch_id.'));
            return ok(await client.renewWatch(form_id, watch_id));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
