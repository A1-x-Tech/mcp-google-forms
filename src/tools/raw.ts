import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleFormsClient, HttpMethod } from "../client.js";
import { DESTRUCTIVE, fail, ok } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleFormsClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Google Forms API call",
      // Full API surface incl. batchUpdate and watch deletion — annotate for the
      // worst case a call can do, not the average.
      annotations: DESTRUCTIVE,
      description:
        'Escape hatch to call any Google Forms API v1 path directly, for requests the typed tools don\'t cover — e.g. a batchUpdate with questionGroupItem grids, writeControl/requiredRevisionId, includeFormInResponse, or several requests at once: path "v1/forms/<formId>:batchUpdate", method POST, body {"requests":[...]}. The path may carry a query string (e.g. "v1/forms/<id>/responses?filter=timestamp%20%3E%202026-08-01T00:00:00Z"). The Bearer token is added automatically; the method defaults to GET.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe('API path relative to https://forms.googleapis.com, e.g. "v1/forms/<formId>:batchUpdate".'),
        method: z
          .enum(["GET", "POST", "DELETE"])
          .optional()
          .describe("HTTP method (the Forms API uses only these three). Defaults to GET."),
        body: z.record(z.any()).optional().describe("JSON request body (POST only)."),
      },
    },
    async ({ path, method, body }) => {
      try {
        const m = (method ?? "GET") as HttpMethod;
        return ok(await client.request(m, path, body));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
