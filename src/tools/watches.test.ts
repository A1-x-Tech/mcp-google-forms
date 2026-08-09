import { test } from "node:test";
import assert from "node:assert/strict";
import { registerWatchTools } from "./watches.js";

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
    createWatch: make("createWatch"),
    listWatches: make("listWatches"),
    deleteWatch: make("deleteWatch"),
    renewWatch: make("renewWatch"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerWatchTools(server as never, client as never);
  return { calls, tools };
}

test("registers manage_watches", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["manage_watches"]);
});

test("each action routes to the matching client method", async () => {
  const { calls, tools } = harness();
  await tools.manage_watches({
    form_id: "f",
    action: "create",
    event_type: "RESPONSES",
    topic_name: "projects/p/topics/t",
    watch_id: "my-watch",
  });
  assert.equal(calls[0].method, "createWatch");
  assert.deepEqual(calls[0].params[0], {
    formId: "f",
    eventType: "RESPONSES",
    topicName: "projects/p/topics/t",
    watchId: "my-watch",
  });

  await tools.manage_watches({ form_id: "f", action: "list" });
  assert.deepEqual(calls[1], { method: "listWatches", params: ["f"] });

  await tools.manage_watches({ form_id: "f", action: "delete", watch_id: "w-1" });
  assert.deepEqual(calls[2], { method: "deleteWatch", params: ["f", "w-1"] });

  await tools.manage_watches({ form_id: "f", action: "renew", watch_id: "w-1" });
  assert.deepEqual(calls[3], { method: "renewWatch", params: ["f", "w-1"] });
});

test("missing per-action params fail without calling the client", async () => {
  const { calls, tools } = harness();

  const create = await tools.manage_watches({ form_id: "f", action: "create" });
  assert.equal(create.isError, true);
  assert.match(create.content[0].text, /requires event_type and topic_name/);

  const del = await tools.manage_watches({ form_id: "f", action: "delete" });
  assert.equal(del.isError, true);
  assert.match(del.content[0].text, /requires watch_id/);

  const renew = await tools.manage_watches({ form_id: "f", action: "renew" });
  assert.equal(renew.isError, true);
  assert.match(renew.content[0].text, /requires watch_id/);

  assert.equal(calls.length, 0, "validation failures must not reach the API");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listWatches" });
  const res = await tools.manage_watches({ form_id: "f", action: "list" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
