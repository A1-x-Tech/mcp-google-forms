import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleFormsClient } from "../client.js";
import { fail, formIdSchema, ok, READ_ONLY, rfc3339Timestamp } from "./util.js";

export function registerResponseTools(server: McpServer, client: GoogleFormsClient): void {
  server.registerTool(
    "list_responses",
    {
      title: "List form responses",
      annotations: READ_ONLY,
      description:
        "Lists submitted responses: responseId, createTime, lastSubmittedTime, respondentEmail (only when email collection is on), answers keyed by questionId (map questionId → question via get_form), and totalScore for graded quizzes. submitted_after keeps only responses submitted strictly after that RFC3339 UTC timestamp — the API's only filter; there is no ordering or email filter, do that client-side. Paginate with page_token from nextPageToken. Note: this endpoint has a lower per-minute quota than other reads — poll incrementally with submitted_after rather than re-listing everything. The API is read-only for responses; submitting them programmatically is impossible.",
      inputSchema: {
        form_id: formIdSchema(),
        submitted_after: rfc3339Timestamp()
          .optional()
          .describe(
            "Only responses submitted after this RFC3339 UTC timestamp, e.g. 2026-08-01T00:00:00Z (exclusive).",
          ),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(5000)
          .optional()
          .describe("Max responses per page (1..5000; the API's default and max is 5000)."),
        page_token: z.string().optional().describe("nextPageToken from the previous page."),
      },
    },
    async ({ form_id, submitted_after, page_size, page_token }) => {
      try {
        return ok(
          await client.listResponses({
            formId: form_id,
            submittedAfter: submitted_after,
            pageSize: page_size,
            pageToken: page_token,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_response",
    {
      title: "Get one response",
      annotations: READ_ONLY,
      description:
        "Fetches a single submission by its responseId (from list_responses): answers keyed by questionId, createTime, lastSubmittedTime, respondentEmail and totalScore when available. Map questionId to the question text via get_form.",
      inputSchema: {
        form_id: formIdSchema(),
        response_id: z.string().min(1).describe("The response id from list_responses."),
      },
    },
    async ({ form_id, response_id }) => {
      try {
        return ok(await client.getResponse(form_id, response_id));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
