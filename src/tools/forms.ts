import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleFormsClient } from "../client.js";
import { fail, formIdSchema, ok, READ_ONLY, UPDATE, WRITE } from "./util.js";

export function registerFormTools(server: McpServer, client: GoogleFormsClient): void {
  server.registerTool(
    "create_form",
    {
      title: "Create a form",
      annotations: WRITE,
      description:
        "Creates a new Google Form and returns it (formId, revisionId, responderUri, publishSettings). The API only accepts a title and an optional document title at creation — add questions with add_question and change settings with update_form_settings afterwards. IMPORTANT: API-created forms are UNPUBLISHED by default and do not accept responses; pass publish=true to publish immediately, or call set_publish_settings later. Share the responderUri with respondents once published.",
      inputSchema: {
        title: z.string().min(1).describe("The form title shown to respondents."),
        document_title: z
          .string()
          .optional()
          .describe("The document name in Google Drive (defaults to the title)."),
        publish: z
          .boolean()
          .optional()
          .describe(
            "Publish the form right away so it accepts responses (default false — the form stays an unpublished draft).",
          ),
      },
    },
    async ({ title, document_title, publish }) => {
      try {
        return ok(await client.createForm({ title, documentTitle: document_title, publish }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_form",
    {
      title: "Get a form",
      annotations: READ_ONLY,
      description:
        "Returns the full form: info (title, description), settings (quiz mode, email collection), items[] with their itemId/questionId and question definitions, publishSettings, responderUri and linkedSheetId. Items are returned in order — their 0-based positions are the indexes that update_question, delete_item and move_item address, so call this before mutating items.",
      inputSchema: { form_id: formIdSchema() },
    },
    async ({ form_id }) => {
      try {
        return ok(await client.getForm(form_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_form_info",
    {
      title: "Update form info",
      annotations: UPDATE,
      description:
        "Changes the form's title, description and/or document title (the Drive file name). Only the provided fields are touched (the updateMask is computed automatically); at least one field is required. Returns the batchUpdate replies with the new revisionId.",
      inputSchema: {
        form_id: formIdSchema(),
        title: z.string().optional().describe("New form title shown to respondents."),
        description: z.string().optional().describe("New form description shown under the title."),
        document_title: z.string().optional().describe("New document name in Google Drive."),
      },
    },
    async ({ form_id, title, description, document_title }) => {
      try {
        return ok(
          await client.updateFormInfo({ formId: form_id, title, description, documentTitle: document_title }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_form_settings",
    {
      title: "Update form settings",
      annotations: UPDATE,
      description:
        "Toggles quiz mode (grading with points) and/or the email collection mode. email_collection_type: DO_NOT_COLLECT, VERIFIED (respondent must be signed in; email verified) or RESPONDER_INPUT (respondent types an email). At least one field is required; only the provided fields are touched.",
      inputSchema: {
        form_id: formIdSchema(),
        is_quiz: z.boolean().optional().describe("Turn quiz mode on/off (enables per-question grading)."),
        email_collection_type: z
          .enum(["DO_NOT_COLLECT", "VERIFIED", "RESPONDER_INPUT"])
          .optional()
          .describe("How respondent emails are collected."),
      },
    },
    async ({ form_id, is_quiz, email_collection_type }) => {
      try {
        return ok(
          await client.updateFormSettings({
            formId: form_id,
            isQuiz: is_quiz,
            emailCollectionType: email_collection_type,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "set_publish_settings",
    {
      title: "Publish or unpublish a form",
      annotations: UPDATE,
      description:
        "Publishes or unpublishes the form and opens/closes response collection. is_accepting_responses defaults to mirroring is_published (publish = start accepting, unpublish = stop). Use is_published=true with is_accepting_responses=false to keep a published form visible but closed. Fails on legacy forms created before the publish model existed — those are managed only in the Forms UI.",
      inputSchema: {
        form_id: formIdSchema(),
        is_published: z.boolean().describe("true = published (respondents can open it), false = unpublished draft."),
        is_accepting_responses: z
          .boolean()
          .optional()
          .describe("Whether the form accepts new responses (defaults to the value of is_published)."),
      },
    },
    async ({ form_id, is_published, is_accepting_responses }) => {
      try {
        return ok(
          await client.setPublishSettings({
            formId: form_id,
            isPublished: is_published,
            isAcceptingResponses: is_accepting_responses,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
