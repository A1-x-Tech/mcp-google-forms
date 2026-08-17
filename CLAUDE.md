# CLAUDE.md — mcp-google-forms

MCP server for the Google Forms API v1 (TypeScript, stdio). Mixed read/write:
tools cover form CRUD, item/question management, publishing, read-only responses
and Pub/Sub watches; `raw_request` is the escape hatch. The server talks to
`https://forms.googleapis.com` with a Bearer token; the token is minted from an
OAuth2 refresh token via `https://oauth2.googleapis.com/token` (or a static
`GOOGLE_FORMS_ACCESS_TOKEN`, mostly for testing). Responses can only ever be
read — the API has no submit endpoint.

## Commands

```bash
npm run dev        # run from source (tsx watch)
npm test           # unit tests + dist smoke, no network
npm run typecheck  # types for src + tests
npm run build      # emit dist/
npm run smoke      # live READ-ONLY check (refresh-flow creds; optional form id argv/GOOGLE_FORMS_SMOKE_FORM_ID)
```

## Architecture

- `src/config.ts` — env → config; throws `ConfigError` (with a `reason` code) instead of
  exiting, so `index.ts` can report the drop-off before dying. Credentials: either the
  refresh triple `GOOGLE_FORMS_CLIENT_ID` + `GOOGLE_FORMS_CLIENT_SECRET` +
  `GOOGLE_FORMS_REFRESH_TOKEN` (all three or `incomplete_oauth_config`) or
  `GOOGLE_FORMS_ACCESS_TOKEN`; optional `GOOGLE_FORMS_API_BASE`,
  `GOOGLE_FORMS_TIMEOUT_MS`, `GOOGLE_FORMS_MAX_RETRIES`.
- `src/client.ts` — all HTTP and all wire mapping. Token lifecycle (cache until ~60s before
  expiry, dedupe concurrent refreshes, one forced re-mint + replay on 401); `request()`
  resolves the path against the base and rejects foreign origins (SSRF guard), enforces an
  AbortController timeout that also covers reading the body, retries 429 always but 5xx/network
  errors **only for GET** — replaying a write after an ambiguous failure would duplicate it —
  and throws `GoogleFormsError(status, body)`. Typed per-endpoint methods build the
  batchUpdate requests and computed updateMasks; `buildQuestionItem()` maps the normalized
  question vocabulary (`text|paragraph|radio|checkbox|dropdown|scale|date|time|rating`) to the
  wire Question union.
- `src/tools/forms.ts` — `create_form` (chains setPublishSettings when `publish` is set),
  `get_form`, `update_form_info`, `update_form_settings`, `set_publish_settings`.
  `src/tools/items.ts` — `add_question`, `update_question`, `delete_item`, `move_item`.
  `src/tools/responses.ts` — `list_responses`, `get_response` (read-only).
  `src/tools/watches.ts` — `manage_watches` (create/list/delete/renew).
  `src/tools/raw.ts` — `raw_request` (GET/POST/DELETE). `src/tools/util.ts` — `ok`/`fail`,
  the four annotation presets (`READ_ONLY`/`WRITE`/`UPDATE`/`DESTRUCTIVE`) and shared zod
  schema factories (`formIdSchema`, `rfc3339Timestamp`, `itemIndexSchema`).
- `src/index.ts` — wires every `register*` into the McpServer.
- `src/telemetry.ts` — anonymous usage pings (ids/names/versions only, never data or
  arguments; fire-and-forget, must never block or throw; opt-out `ASKADS_TELEMETRY=0`).
  `startup_failed` is the exception: `sendBlocking` awaits it, because the caller exits right
  after. Its `reason` is a closed vocabulary (`missing_credentials`,
  `incomplete_oauth_config`) — never a variable's name or value.

## Conventions (do not break)

- **Never retry a write on 5xx/network errors.** Only 429 (rejected before executing) and GET
  are safe; the gate lives in `request()` and is pinned by tests.
- **No response-submission tool, ever.** The API cannot submit responses; don't fake it.
- **Wire mapping lives in the client, not the tools.** Tools accept the normalized snake_case
  vocabulary and must not know the wire enums (`RADIO`, `DROP_DOWN`, `THUMB_UP`, updateMask
  paths) — add any mapping in `client.ts`.
- **Auth is the client's job.** Tools never see tokens; the Bearer header, refresh, caching
  and the 401 replay all live in `request()`/`accessToken()`.
- **Items are addressed by index**, not itemId — descriptions must keep steering the model to
  `get_form` before `update_question`/`delete_item`/`move_item`.
- **Validate inputs with zod** in `inputSchema`; reuse the shared schema **factories** in
  `util.ts` (a fresh schema per field avoids `$ref` dedup in the JSON schema).
- **Annotations are pinned per tool** in `annotations.test.ts` — changing one is a conscious
  decision that updates the map, with all four hints always set.
- **Output compact JSON via `ok`** — the consumer is an LLM; pretty-printing burns tokens.
  Responses pass through verbatim (describe the fields in the tool `description`, the only
  place the external model reads).

## Adding a tool

Before changing the tool registry, read [the MCP capability documentation contract](docs/CAPABILITY-DOCUMENTATION.md). Every registered tool must have exactly one task-oriented page in `docs/capabilities/`; update that page, the index, and the coverage test in the same change.

1. Add (or extend) `src/tools/<name>.ts` with `register<Name>Tools(server, client)`.
2. If it hits a new endpoint, add a method to `src/client.ts` with the wire mapping.
3. Import and call the register fn in `src/index.ts`.
4. Add a `*.test.ts` using the mock-fetch (client) / fake-client (tools) harness — no
   network — and add the tool + hints to `annotations.test.ts` and `test/dist-smoke.test.js`.
5. `npm run typecheck && npm test`.

## Releasing

Keep the version in sync across **all** channels in one go (`git push --follow-tags` pushes
the tag but does **not** create a GitHub Release; the registry is immutable per version):

1. Bump `version` in **three places, identically**: `package.json`, and in `server.json`
   **both** the root `version` **and** `packages[0].version`. `mcpName` in `package.json` must
   match `name` in `server.json` (`io.github.A1-x-Tech/mcp-google-forms`). Verify:
   `grep -n '"version"' package.json server.json`.
   > ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. A stale root makes
   > `mcp-publisher publish` fail with a misleading `400 cannot publish duplicate version`
   > while `npm publish` succeeds.
2. Update `CHANGELOG.md`, then `npm publish` (runs typecheck + tests + build via
   `prepublishOnly` / `prepare`).
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:** `mcp-publisher publish` (login with
   `mcp-publisher login github --token "$(gh auth token)"`).
