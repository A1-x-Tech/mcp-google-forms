import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleFormsClient } from "../dist/client.js";
import { registerFormTools } from "../dist/tools/forms.js";
import { registerItemTools } from "../dist/tools/items.js";
import { registerResponseTools } from "../dist/tools/responses.js";
import { registerWatchTools } from "../dist/tools/watches.js";
import { registerRawTool } from "../dist/tools/raw.js";

const ALL_TOOLS = [
  "add_question",
  "create_form",
  "delete_item",
  "get_form",
  "get_response",
  "list_responses",
  "manage_watches",
  "move_item",
  "raw_request",
  "set_publish_settings",
  "update_form_info",
  "update_form_settings",
  "update_question",
];

test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleFormsClient({
      accessToken: "SECRET",
      apiBase: "https://forms.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("GET", "https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the Bearer token and JSON bodies", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response('{"formId":"f-1"}', { status: 200 });
  };
  try {
    const client = new GoogleFormsClient({
      accessToken: "SECRET",
      apiBase: "https://forms.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await client.createForm({ title: "Smoke" });
    assert.equal(seen.url, "https://forms.googleapis.com/v1/forms");
    assert.equal(seen.auth, "Bearer SECRET");
    assert.deepEqual(seen.body, { info: { title: "Smoke" } });
  } finally {
    globalThis.fetch = original;
  }
});

test("dist registers the expected tools", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerFormTools(server, client);
  registerItemTools(server, client);
  registerResponseTools(server, client);
  registerWatchTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_FORMS_ACCESS_TOKEN: "test-token",
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-forms");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Google Forms API v1/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const getForm = tools.find((t) => t.name === "get_form");
    assert.equal(getForm.annotations?.readOnlyHint, true);
    assert.ok(getForm.inputSchema?.properties?.form_id, "input schema must reach the client");
  } finally {
    await client.close();
  }
});
