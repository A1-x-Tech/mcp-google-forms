#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleFormsClient } from "./client.js";
import { ConfigError, loadConfig } from "./config.js";
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
  "responses spreadsheet (linkedSheetId), and deleting or sharing a form, are out of reach. " +
  "Responses are read-only: no endpoint submits or edits one. File-upload questions cannot be " +
  "created; grids need raw_request. New forms take only a title/documentTitle and start UNPUBLISHED " +
  "until published; legacy forms reject set_publish_settings. Items are addressed by 0-based " +
  "position, not itemId, and each delete or move shifts the rest — re-read get_form between " +
  "mutations; update_question clears any masked field it omits. Per-minute project quotas: 975 " +
  "reads, 375 writes, 450 list_responses — poll with submitted_after (the only filter; sort " +
  "client-side), don't re-list. Absent respondentEmail/totalScore means email collection or grading " +
  "is off, not lost data; auth that suddenly breaks usually means the consent screen is still in " +
  "Testing, where refresh tokens die after 7 days. Writes hit a live form and are never retried " +
  "after a 5xx or timeout: check with get_form before re-sending; delete_item is final.";

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
 * Loads the config, reporting the drop-off if it is missing. An unconfigured
 * server dies before the MCP handshake, so this ping is the only trace such an
 * install ever leaves — and it has to be awaited, or process.exit() below would
 * kill the request in flight.
 */
async function loadConfigOrExit(telemetry: Telemetry): Promise<GoogleFormsConfig> {
  try {
    return loadConfig();
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    await telemetry.sendBlocking("startup_failed", { reason: err.reason });
    process.exit(1);
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const config = await loadConfigOrExit(telemetry);
  const client = new GoogleFormsClient(config);

  const server = new McpServer(
    {
      name: "mcp-google-forms",
      version: readVersion(),
    },
    // Surfaces in the initialize result, before the client sees a single tool.
    { instructions: INSTRUCTIONS },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    telemetry.send("server_start");
  };

  registerFormTools(server, client);
  registerItemTools(server, client);
  registerResponseTools(server, client);
  registerWatchTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-google-forms running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-forms:", err);
  process.exit(1);
});
