#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleFormsClient } from "./client.js";
import { ConfigError, DEFAULT_BASE, hasCredentials, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { GoogleFormsConfig } from "./types.js";
import { registerFormTools } from "./tools/forms.js";
import { registerItemTools } from "./tools/items.js";
import { registerResponseTools } from "./tools/responses.js";
import { registerWatchTools } from "./tools/watches.js";
import { registerRawTool } from "./tools/raw.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which Google product this API is,
 * what the API refuses to do, and the behaviours that make a naive loop
 * expensive, lossy or duplicating.
 */
const INSTRUCTIONS =
  "Google Forms API v1 builds and reads Google Forms — not Sheets, Docs or Drive: the linked " +
  "responses spreadsheet (linkedSheetId), and deleting, sharing or renaming the Drive file, are " +
  "out of reach. Responses are read-only: no endpoint submits or edits one. File-upload questions " +
  "cannot be created; grids need raw_request. New forms take only a title/documentTitle (the Drive " +
  "file name — settable only at creation) and start UNPUBLISHED until published; legacy forms " +
  "reject set_publish_settings. Items are addressed by 0-based position, not itemId, and each " +
  "delete or move shifts the rest — re-read get_form between mutations; update_question clears " +
  "any masked field it omits. Quiz mode alone grades nothing: add_question cannot set points — " +
  "write questionItem.question.grading per question via update_question. Per-minute project quotas: 975 " +
  "reads, 375 writes, 450 list_responses — poll with submitted_after (the only filter; sort " +
  "client-side), don't re-list. Absent respondentEmail/totalScore means email collection or grading " +
  "is off, not lost data; auth that suddenly breaks usually means the consent screen is still in " +
  "Testing, where refresh tokens die after 7 days. Writes hit a live form and are never retried " +
  "after a 5xx or timeout: check with get_form before re-sending; delete_item is final.";

/**
 * Prepended to INSTRUCTIONS when no credentials are configured. The model reads
 * this before it picks a tool, so an unconfigured session opens with the fix
 * rather than with a failed call. There is no in-chat login here: credentials
 * come only from the environment, so the fix is an operator action + restart.
 */
const UNCONFIGURED_PREFIX =
  "ATTENTION: Google Forms is not connected yet — no credentials are configured, so every " +
  "tool call will fail. The operator must set GOOGLE_FORMS_CLIENT_ID + " +
  "GOOGLE_FORMS_CLIENT_SECRET + GOOGLE_FORMS_REFRESH_TOKEN (recommended), or " +
  "GOOGLE_FORMS_ACCESS_TOKEN with a short-lived access token, in the MCP client's " +
  "server config and restart this server — the variables are read only at startup. ";

/** Reads the package version so the server reports its real version to MCP clients. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Loads the config without dying on a bad value. A server that exits here never
 * completes the MCP handshake, so the user sees a dead server and no reason.
 * Instead the problem is carried into the session, where the model can read it
 * and relay it: the config degrades to "no credentials" and every tool call
 * fails with the actionable message.
 */
function loadConfigOrDegraded(telemetry: Telemetry): {
  config: GoogleFormsConfig;
  problem?: ConfigError;
} {
  try {
    return { config: loadConfig() };
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    // Fire-and-forget now that the process survives: the historical
    // `startup_failed` funnel stays comparable, but nothing blocks startup.
    telemetry.send("startup_failed", { reason: err.reason });
    return {
      config: { apiBase: process.env.GOOGLE_FORMS_API_BASE || DEFAULT_BASE },
      problem: err,
    };
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const { config, problem } = loadConfigOrDegraded(telemetry);
  const client = new GoogleFormsClient(config);

  // Decided once, at startup: credentials come only from the environment, so
  // "restart after setting the variables" is the accurate advice to give.
  const connected = hasCredentials(config);

  const server = new McpServer(
    {
      name: "mcp-google-forms",
      version: readVersion(),
    },
    // Surfaces in the initialize result, before the client sees a single tool.
    {
      instructions: connected
        ? INSTRUCTIONS
        : UNCONFIGURED_PREFIX + (problem ? `Configuration problem: ${problem.message} ` : "") + INSTRUCTIONS,
    },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    // Split on purpose: `server_start` keeps meaning "a usable install started",
    // so the unconfigured case gets its own event instead of inflating that number.
    if (connected) telemetry.send("server_start");
    else telemetry.send("unconfigured_start", { reason: problem?.reason ?? "missing_credentials" });
  };

  registerFormTools(server, client);
  registerItemTools(server, client);
  registerResponseTools(server, client);
  registerWatchTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-google-forms running on stdio${connected ? "" : " (no credentials — set the environment variables and restart)"}`,
  );
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-forms:", err);
  process.exit(1);
});
