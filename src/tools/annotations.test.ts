import { test } from "node:test";
import assert from "node:assert/strict";
import { registerFormTools } from "./forms.js";
import { registerItemTools } from "./items.js";
import { registerResponseTools } from "./responses.js";
import { registerWatchTools } from "./watches.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, UPDATE, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerFormTools(server as never, {} as never);
  registerItemTools(server as never, {} as never);
  registerResponseTools(server as never, {} as never);
  registerWatchTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The Forms API mixes reads and writes, so instead of one blanket invariant the
 * expected hints are pinned per tool. Changing a tool's annotation must be a
 * conscious decision that updates this map.
 */
const EXPECTED: Record<string, Annotations> = {
  create_form: WRITE,
  get_form: READ_ONLY,
  update_form_info: UPDATE,
  update_form_settings: UPDATE,
  set_publish_settings: UPDATE,
  add_question: WRITE,
  update_question: UPDATE,
  delete_item: DESTRUCTIVE,
  move_item: WRITE,
  list_responses: READ_ONLY,
  get_response: READ_ONLY,
  manage_watches: DESTRUCTIVE,
  raw_request: DESTRUCTIVE,
};

test("registers all thirteen tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("responses stay read-only — the API cannot submit or change them", () => {
  for (const name of ["list_responses", "get_response"]) {
    assert.equal(ANN[name]?.readOnlyHint, true, `${name} must be read-only`);
  }
});
