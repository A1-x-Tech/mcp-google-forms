import { test } from "node:test";
import assert from "node:assert/strict";
import { registerItemTools } from "./items.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { ok: true };
    };
  const client = {
    addQuestion: make("addQuestion"),
    updateItem: make("updateItem"),
    deleteItem: make("deleteItem"),
    moveItem: make("moveItem"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerItemTools(server as never, client as never);
  return { calls, tools };
}

test("registers the four item tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["add_question", "delete_item", "move_item", "update_question"]);
});

test("add_question maps snake_case inputs to the client's normalized params", async () => {
  const { calls, tools } = harness();
  await tools.add_question({
    form_id: "f",
    title: "Rate us",
    type: "rating",
    required: true,
    rating_scale_level: 7,
    rating_icon_type: "heart",
    index: 1,
  });
  assert.equal(calls[0].method, "addQuestion");
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.formId, "f");
  assert.equal(params.title, "Rate us");
  assert.equal(params.type, "rating");
  assert.equal(params.required, true);
  assert.equal(params.ratingScaleLevel, 7);
  assert.equal(params.ratingIconType, "heart");
  assert.equal(params.index, 1);
});

test("update_question forwards the raw item and update mask", async () => {
  const { calls, tools } = harness();
  await tools.update_question({
    form_id: "f",
    index: 3,
    item: { title: "New" },
    update_mask: "title",
  });
  assert.deepEqual(calls[0].params[0], { formId: "f", index: 3, item: { title: "New" }, updateMask: "title" });
});

test("delete_item and move_item address items by index", async () => {
  const { calls, tools } = harness();
  await tools.delete_item({ form_id: "f", index: 2 });
  assert.deepEqual(calls[0], { method: "deleteItem", params: ["f", 2] });
  await tools.move_item({ form_id: "f", from_index: 0, to_index: 4 });
  assert.deepEqual(calls[1], { method: "moveItem", params: ["f", 0, 4] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "deleteItem" });
  const res = await tools.delete_item({ form_id: "f", index: 0 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
