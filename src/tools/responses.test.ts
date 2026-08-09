import { test } from "node:test";
import assert from "node:assert/strict";
import { registerResponseTools } from "./responses.js";

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
    listResponses: make("listResponses"),
    getResponse: make("getResponse"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerResponseTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two response tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["get_response", "list_responses"]);
});

test("list_responses forwards the time filter and pagination", async () => {
  const { calls, tools } = harness();
  await tools.list_responses({
    form_id: "f",
    submitted_after: "2026-08-01T00:00:00Z",
    page_size: 50,
    page_token: "tok",
  });
  assert.equal(calls[0].method, "listResponses");
  assert.deepEqual(calls[0].params[0], {
    formId: "f",
    submittedAfter: "2026-08-01T00:00:00Z",
    pageSize: 50,
    pageToken: "tok",
  });
});

test("get_response forwards form and response ids", async () => {
  const { calls, tools } = harness();
  await tools.get_response({ form_id: "f", response_id: "r-1" });
  assert.deepEqual(calls[0], { method: "getResponse", params: ["f", "r-1"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listResponses" });
  const res = await tools.list_responses({ form_id: "f" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
