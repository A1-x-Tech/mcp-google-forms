import { test } from "node:test";
import assert from "node:assert/strict";
import { registerFormTools } from "./forms.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
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
    createForm: make("createForm"),
    getForm: make("getForm"),
    updateFormInfo: make("updateFormInfo"),
    updateFormSettings: make("updateFormSettings"),
    setPublishSettings: make("setPublishSettings"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerFormTools(server as never, client as never);
  return { calls, tools };
}

test("registers the five form tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "create_form",
    "get_form",
    "set_publish_settings",
    "update_form_info",
    "update_form_settings",
  ]);
});

test("create_form forwards title/document_title/publish normalized", async () => {
  const { calls, tools } = harness();
  await tools.create_form({ title: "Survey", document_title: "Doc", publish: true });
  assert.equal(calls[0].method, "createForm");
  assert.deepEqual(calls[0].params[0], { title: "Survey", documentTitle: "Doc", publish: true });
});

test("get_form passes the form id through", async () => {
  const { calls, tools } = harness();
  await tools.get_form({ form_id: "f-1" });
  assert.equal(calls[0].method, "getForm");
  assert.deepEqual(calls[0].params, ["f-1"]);
});

test("update_form_info and update_form_settings forward normalized params", async () => {
  const { calls, tools } = harness();
  await tools.update_form_info({ form_id: "f", title: "T", description: "D" });
  assert.deepEqual(calls[0].params[0], { formId: "f", title: "T", description: "D" });
  await tools.update_form_settings({ form_id: "f", is_quiz: true, email_collection_type: "VERIFIED" });
  assert.deepEqual(calls[1].params[0], { formId: "f", isQuiz: true, emailCollectionType: "VERIFIED" });
});

test("set_publish_settings forwards the publish state", async () => {
  const { calls, tools } = harness();
  await tools.set_publish_settings({ form_id: "f", is_published: true, is_accepting_responses: false });
  assert.deepEqual(calls[0].params[0], { formId: "f", isPublished: true, isAcceptingResponses: false });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "createForm" });
  const res = await tools.create_form({ title: "Survey" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
