import { test } from "node:test";
import assert from "node:assert/strict";

import { ConfigError, loadConfig } from "./config.js";

/**
 * The reason codes below are the vocabulary the telemetry dashboard groups by —
 * renaming one silently splits a bar in two, so they are pinned here.
 */
function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const keys = [
    "GOOGLE_FORMS_CLIENT_ID",
    "GOOGLE_FORMS_CLIENT_SECRET",
    "GOOGLE_FORMS_REFRESH_TOKEN",
    "GOOGLE_FORMS_ACCESS_TOKEN",
    "GOOGLE_FORMS_API_BASE",
    "GOOGLE_FORMS_TIMEOUT_MS",
    "GOOGLE_FORMS_MAX_RETRIES",
    ...Object.keys(vars),
  ];
  const saved = new Map(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) process.env[k] = v;
  }
  try {
    run();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function reasonOf(vars: Record<string, string | undefined>): string {
  let caught: unknown;
  withEnv(vars, () => {
    try {
      loadConfig();
    } catch (err) {
      caught = err;
    }
  });
  assert.ok(caught instanceof ConfigError, "config problems must throw ConfigError, not exit");
  return caught.reason;
}

test("no credentials at all reports missing_credentials", () => {
  assert.equal(reasonOf({}), "missing_credentials");
});

test("a partial OAuth triple reports incomplete_oauth_config", () => {
  assert.equal(reasonOf({ GOOGLE_FORMS_CLIENT_ID: "id" }), "incomplete_oauth_config");
  assert.equal(
    reasonOf({ GOOGLE_FORMS_CLIENT_ID: "id", GOOGLE_FORMS_CLIENT_SECRET: "secret" }),
    "incomplete_oauth_config",
  );
  // Even with a static access token present, a half-configured refresh flow is
  // an error, not something to silently ignore.
  assert.equal(
    reasonOf({ GOOGLE_FORMS_REFRESH_TOKEN: "rt", GOOGLE_FORMS_ACCESS_TOKEN: "at" }),
    "incomplete_oauth_config",
  );
});

test("the full refresh triple loads without throwing", () => {
  withEnv(
    {
      GOOGLE_FORMS_CLIENT_ID: "id",
      GOOGLE_FORMS_CLIENT_SECRET: "secret",
      GOOGLE_FORMS_REFRESH_TOKEN: "rt",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.clientId, "id");
      assert.equal(config.refreshToken, "rt");
      assert.equal(config.apiBase, "https://forms.googleapis.com");
    },
  );
});

test("a static access token alone is enough", () => {
  withEnv({ GOOGLE_FORMS_ACCESS_TOKEN: "at" }, () => {
    assert.equal(loadConfig().accessToken, "at");
  });
});

test("invalid numeric overrides fall back to the defaults", () => {
  withEnv(
    {
      GOOGLE_FORMS_ACCESS_TOKEN: "at",
      GOOGLE_FORMS_TIMEOUT_MS: "not-a-number",
      GOOGLE_FORMS_MAX_RETRIES: "-5",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 60_000);
      assert.equal(config.maxRetries, 3);
    },
  );
});

test("numeric overrides are honored when valid", () => {
  withEnv(
    { GOOGLE_FORMS_ACCESS_TOKEN: "at", GOOGLE_FORMS_TIMEOUT_MS: "1000", GOOGLE_FORMS_MAX_RETRIES: "0" },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 1000);
      assert.equal(config.maxRetries, 0);
    },
  );
});
