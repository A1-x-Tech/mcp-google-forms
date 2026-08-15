import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleFormsClient } from "../client.js";
import { DESTRUCTIVE, fail, formIdSchema, itemIndexSchema, ok, UPDATE, WRITE } from "./util.js";

export function registerItemTools(server: McpServer, client: GoogleFormsClient): void {
  server.registerTool(
    "add_question",
    {
      title: "Add a question",
      annotations: WRITE,
      description:
        "Adds a question to the form (a convenience wrapper over batchUpdate createItem). Types: text (short answer), paragraph (long answer), radio (single choice), checkbox (multiple choice), dropdown, scale (linear scale low..high), date, time, rating (stars/hearts/thumbs). Choice types require options[]. Returns the created itemId and questionId from the batchUpdate replies. index inserts at that 0-based position; omit it to append at the end (costs one extra read to count items). Quiz grading (points, correct answers, feedback) cannot be set here — after adding, use update_question with the questionItem.question.grading mask. File-upload questions cannot be created via the API, and question grids (questionGroupItem) need raw_request with a batchUpdate body.",
      inputSchema: {
        form_id: formIdSchema(),
        title: z.string().min(1).describe("The question text shown to respondents."),
        type: z
          .enum(["text", "paragraph", "radio", "checkbox", "dropdown", "scale", "date", "time", "rating"])
          .describe("The question type."),
        description: z.string().optional().describe("Help text shown under the question."),
        required: z.boolean().optional().describe("Whether an answer is required to submit."),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("0-based position to insert at; omitted = append after the last item."),
        options: z
          .array(z.string().min(1))
          .optional()
          .describe("The choices — required for radio, checkbox and dropdown."),
        shuffle: z.boolean().optional().describe("Shuffle option order per respondent (choice types)."),
        low: z.number().int().optional().describe("Scale lower bound (default 1; scale type)."),
        high: z.number().int().optional().describe("Scale upper bound (default 5; scale type)."),
        low_label: z.string().optional().describe("Label for the lowest scale point."),
        high_label: z.string().optional().describe("Label for the highest scale point."),
        include_time: z.boolean().optional().describe("Date question also asks for a time of day."),
        include_year: z.boolean().optional().describe("Date question includes the year."),
        duration: z
          .boolean()
          .optional()
          .describe("Time question asks for an elapsed duration instead of a time of day."),
        rating_scale_level: z
          .number()
          .int()
          .min(3)
          .max(10)
          .optional()
          .describe("Number of rating icons (3..10; default 5; rating type)."),
        rating_icon_type: z
          .enum(["star", "heart", "thumb_up"])
          .optional()
          .describe("Rating icon (default star)."),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.addQuestion({
            formId: args.form_id,
            title: args.title,
            type: args.type,
            description: args.description,
            required: args.required,
            index: args.index,
            options: args.options,
            shuffle: args.shuffle,
            low: args.low,
            high: args.high,
            lowLabel: args.low_label,
            highLabel: args.high_label,
            includeTime: args.include_time,
            includeYear: args.include_year,
            duration: args.duration,
            ratingScaleLevel: args.rating_scale_level,
            ratingIconType: args.rating_icon_type,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_question",
    {
      title: "Update an item",
      annotations: UPDATE,
      description:
        'Updates an existing item (question or other) via batchUpdate updateItem. The item is addressed by its 0-based index — call get_form first to see current positions and the item\'s current shape. item is a raw Forms API Item object with the new values; update_mask names the fields to replace, e.g. "title" or "title,questionItem.question.required". Only masked fields change; masking a field the item object leaves unset clears it.',
      inputSchema: {
        form_id: formIdSchema(),
        index: itemIndexSchema().describe("0-based position of the item to update (from get_form)."),
        item: z
          .record(z.any())
          .describe(
            'The Forms API Item object with the new values, e.g. {"title":"New title","questionItem":{"question":{"required":true}}}.',
          ),
        update_mask: z
          .string()
          .min(1)
          .describe('Comma-separated field paths to replace, e.g. "title,questionItem.question.required".'),
      },
    },
    async ({ form_id, index, item, update_mask }) => {
      try {
        return ok(await client.updateItem({ formId: form_id, index, item, updateMask: update_mask }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_item",
    {
      title: "Delete an item",
      annotations: DESTRUCTIVE,
      description:
        "Deletes the item at the given 0-based index (question, page break, text block, ...). Deletion shifts every later item one position down — re-check indexes with get_form between successive deletes.",
      inputSchema: {
        form_id: formIdSchema(),
        index: itemIndexSchema().describe("0-based position of the item to delete (from get_form)."),
      },
    },
    async ({ form_id, index }) => {
      try {
        return ok(await client.deleteItem(form_id, index));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "move_item",
    {
      title: "Move an item",
      annotations: WRITE,
      description:
        "Moves the item at from_index to to_index (both 0-based, to_index is the position after removal). Use get_form to see the current order first.",
      inputSchema: {
        form_id: formIdSchema(),
        from_index: itemIndexSchema().describe("Current 0-based position of the item."),
        to_index: itemIndexSchema().describe("Target 0-based position."),
      },
    },
    async ({ form_id, from_index, to_index }) => {
      try {
        return ok(await client.moveItem(form_id, from_index, to_index));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
