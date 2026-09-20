# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-09-20

### Added

- In-chat Google login via `@a1-x-tech/mcp-google-auth` — 6 new onboarding
  tools: `auth_status`, `setup_instructions`, `set_client`, `start_login`
  (deliberately not read-only), `finish_login`, `logout`. The flow is loopback
  `127.0.0.1` + PKCE against a user-owned Desktop OAuth client; the code is
  exchanged locally and the client secret never passes through the chat. Each
  tool has a capability page under `docs/capabilities/`.
- Tokens from a login are stored per server in
  `~/.config/mcp-google-forms/credentials.json` (0600) and re-read on every
  call, so a login finished mid-session works without restarting the AI client.
  `GOOGLE_FORMS_OAUTH_PORT` pins the loopback listener port for SSH forwarding.

### Changed

- The client accepts the component's `TokenProvider` as a fallback token
  source: environment credentials (the refresh triple or `GOOGLE_FORMS_ACCESS_TOKEN`)
  keep absolute priority and behave exactly as before; the stored in-chat login
  is used only when the environment carries no credentials. The single 401
  re-mint + replay works for provider-backed tokens too, and is skipped when
  nothing can be re-minted.
- The unconfigured `initialize` instructions lead with the in-chat login
  (`setup_instructions` → `set_client` → `start_login` → `finish_login`, no
  restart needed); setting the environment variables + restart remains the
  documented alternative.

## [1.1.0] — 2026-08-19

### Changed

- **The server no longer exits because of configuration.** Missing credentials are a
  survivable state: the server starts, completes the MCP handshake, serves the full tool list
  and opens the `initialize` instructions with the fix (which variables to set, and that the
  server must be restarted afterwards — credentials are read from the environment only at
  startup). The first tool call then fails with that same actionable message instead of the
  client showing a dead server with no reason. A malformed setup (a partial refresh triple)
  still reports `incomplete_oauth_config`, but degrades the same way — its message is carried
  into the instructions — instead of killing the process before the handshake.

### Added

- Telemetry event `unconfigured_start` (with the same closed reason vocabulary): a server
  without credentials now survives to the MCP handshake, so a degraded start is counted
  separately instead of inflating `server_start` or dying as `startup_failed`.

## [1.0.1] — 2026-08-12

### Added

- Server instructions. The MCP `initialize` response now carries a short briefing for the calling
  model: what this API is and is not, what it cannot do, and the quotas, retry rules and misleading
  failures that should change how it is used. That knowledge previously lived only in the README,
  which a model never reads.

## [1.0.0] — 2026-08-11

### Changed

- Declared stable. The tool surface, input schemas and environment variables of 0.1.x carry over
  unchanged — this release marks API stability, not new behaviour.

## [0.1.0] — 2026-08-09

### Added
- First real release: a full MCP server for the Google Forms API v1 (stdio,
  TypeScript, `@modelcontextprotocol/sdk` + `zod`).
- Tools (13):
  - `create_form` — create a form, optionally publishing it in the same call
    (API-created forms start unpublished and would otherwise accept no responses);
  - `get_form` — full form structure with item ids and positions;
  - `update_form_info`, `update_form_settings` — title/description/document title,
    quiz mode and email collection, with computed update masks;
  - `add_question` — a convenience wrapper over `batchUpdate createItem` covering
    text, paragraph, radio, checkbox, dropdown, scale, date, time and rating
    questions (appends at the end when no index is given);
  - `update_question`, `delete_item`, `move_item` — index-addressed item mutations;
  - `set_publish_settings` — publish/unpublish, open/close response collection;
  - `list_responses` (with the `submitted_after` timestamp filter and pagination),
    `get_response` — read-only, as the API cannot submit responses;
  - `manage_watches` — create/list/delete/renew Cloud Pub/Sub watches;
  - `raw_request` — escape hatch to any Forms API v1 path (SSRF-guarded).
- OAuth2 refresh flow: access tokens are minted from
  `GOOGLE_FORMS_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`, cached until just
  before expiry, deduped across concurrent requests and re-minted once on a 401;
  a static `GOOGLE_FORMS_ACCESS_TOKEN` works as an alternative.
- Resilience: request timeout covering body reads, `Retry-After`-aware backoff,
  429 retried for every method, 5xx/network retries gated to reads so writes are
  never replayed.
- Anonymous usage telemetry (event/tool names and versions only; opt out with
  `ASKADS_TELEMETRY=0`), including the `startup_failed` drop-off ping.
- Offline test suite (74 tests): mocked-fetch client tests incl. the OAuth flow,
  fake-server tool tests, pinned per-tool annotations, plus a dist smoke test
  that spawns the built binary and performs a real MCP handshake over stdio.
- CI (Node 20/22: typecheck + build + tests) and a daily live health check that
  skips itself when repo secrets are absent.

## [0.0.1] — 2026-08-09

### Added
- npm name reservation stub.

[Unreleased]: https://github.com/A1-x-Tech/mcp-google-forms/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/A1-x-Tech/mcp-google-forms/releases/tag/v1.0.1
[1.0.0]: https://github.com/A1-x-Tech/mcp-google-forms/releases/tag/v1.0.0
[0.1.0]: https://github.com/A1-x-Tech/mcp-google-forms/releases/tag/v0.1.0
[0.0.1]: https://github.com/A1-x-Tech/mcp-google-forms/commits/main
