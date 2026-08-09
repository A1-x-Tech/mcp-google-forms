# Google Forms MCP

[![npm](https://img.shields.io/npm/v/mcp-google-forms)](https://www.npmjs.com/package/mcp-google-forms)
[![CI](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

MCP server for the **Google Forms API**: create forms, add and edit questions, publish, read
responses and set up push notifications for new submissions — from Claude, Cursor, Codex and
other AI clients, in natural language.

Ask your assistant to "make a customer-feedback survey with a rating question and publish it",
"show me yesterday's responses", or "close the form for responses" — it drives the Forms API
for you, from a blank form to response analysis.

## Quick start

1. [Get OAuth credentials](#getting-credentials) for the Google Forms API.
2. Add the server — for example, in Claude Code ([other clients](#installation)):

   ```bash
   claude mcp add google-forms \
     -e GOOGLE_FORMS_CLIENT_ID=your_client_id \
     -e GOOGLE_FORMS_CLIENT_SECRET=your_client_secret \
     -e GOOGLE_FORMS_REFRESH_TOKEN=your_refresh_token \
     -- npx -y mcp-google-forms
   ```

3. Ask the assistant: *"Create a form called 'Team lunch survey' with a dropdown of three
   restaurants and publish it."*

## Tools

| Tool | Description |
|---|---|
| `create_form` | Create a form (optionally publish it right away — API-created forms start unpublished). |
| `get_form` | Full form structure: info, settings, items with ids, publish state, responder URL. |
| `update_form_info` | Change the title, description or document title. |
| `update_form_settings` | Toggle quiz mode and email collection. |
| `add_question` | Add a question: text, paragraph, radio, checkbox, dropdown, scale, date, time, rating. |
| `update_question` | Update an existing item by index with an explicit update mask. |
| `delete_item` | Delete the item at an index. |
| `move_item` | Reorder items. |
| `set_publish_settings` | Publish/unpublish, open/close response collection. |
| `list_responses` | List submissions, incrementally with `submitted_after`; paginated. |
| `get_response` | Fetch one submission by id. |
| `manage_watches` | Create/list/delete/renew Cloud Pub/Sub push-notification watches. |
| `raw_request` | Escape hatch: any Forms API v1 path (e.g. a custom `batchUpdate` with grids). |

Plus resilience built in: automatic OAuth token refresh (including on 401), retries with
backoff on 429 (and on 5xx/network errors for reads only — writes are never replayed), a
request timeout, and an SSRF guard so the token can't leak to a foreign host.

## Example prompts

- "Create an RSVP form for the offsite, ask for name, meal preference (veg/meat/fish) and
  arrival date, then publish it and give me the link."
- "Turn the 'Onboarding quiz' form into a quiz and make every question required."
- "How many responses came in since Monday? Summarize the free-text feedback."
- "Stop accepting responses on the feedback form."

## Limitations (the API's, not the server's)

- **Responses are read-only.** The Forms API cannot submit or edit responses — there is no
  such endpoint, so this server has no submit tool either.
- **API-created forms start unpublished** and don't accept responses until published — use
  `publish: true` on `create_form` or `set_publish_settings`. Legacy forms (from before the
  publish model) don't support `set_publish_settings` at all.
- **File-upload questions can't be created** via the API (existing ones are readable).
- **Quotas are per minute** (reads 975/project, `list_responses` 450, writes 375); the server
  backs off on 429 automatically.

## Installation

Requires Node.js 20+ (runs via `npx`, no separate install).

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add google-forms \
  -e GOOGLE_FORMS_CLIENT_ID=your_client_id \
  -e GOOGLE_FORMS_CLIENT_SECRET=your_client_secret \
  -e GOOGLE_FORMS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y mcp-google-forms
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

`claude_desktop_config.json` — macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "mcp-google-forms"],
      "env": {
        "GOOGLE_FORMS_CLIENT_ID": "your_client_id",
        "GOOGLE_FORMS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_FORMS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Cursor</b></summary>

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in the project)

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "mcp-google-forms"],
      "env": {
        "GOOGLE_FORMS_CLIENT_ID": "your_client_id",
        "GOOGLE_FORMS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_FORMS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

</details>

<details>
<summary><b>VS Code</b></summary>

`.vscode/mcp.json` — note the `servers` key (not `mcpServers`)

```json
{
  "servers": {
    "google-forms": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-forms"],
      "env": {
        "GOOGLE_FORMS_CLIENT_ID": "your_client_id",
        "GOOGLE_FORMS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_FORMS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

</details>

## Getting credentials

The Forms API has no API-key access — every call needs OAuth 2.0. One-time setup, ~10 minutes:

1. **Create a Google Cloud project** (or reuse one) at
   [console.cloud.google.com](https://console.cloud.google.com/), then enable the
   **Google Forms API**: *APIs & Services → Library → Google Forms API → Enable*.
2. **Configure the OAuth consent screen** (*APIs & Services → OAuth consent screen*): choose
   *External*, fill in the app name and your email, and add your Google account under
   **Test users** (in Testing mode only listed users can authorize — no app verification needed).
3. **Create an OAuth client** (*APIs & Services → Credentials → Create credentials → OAuth
   client ID*), application type **Desktop app**. Save the **client ID** and **client secret**.
4. **Mint a refresh token.** The easiest way is the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   - Click the gear icon → check **Use your own OAuth credentials** → paste your client ID and
     secret (add `https://developers.google.com/oauthplayground` as an authorized redirect URI
     to the OAuth client first).
   - In *Step 1*, enter the scopes
     `https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.responses.readonly`
     and click **Authorize APIs**, signing in with the test-user account.
   - In *Step 2*, click **Exchange authorization code for tokens** and copy the
     **refresh token**.
5. Put the three values into `GOOGLE_FORMS_CLIENT_ID`, `GOOGLE_FORMS_CLIENT_SECRET` and
   `GOOGLE_FORMS_REFRESH_TOKEN`. The server exchanges the refresh token for short-lived access
   tokens automatically.

Scope notes: `forms.body` + `forms.responses.readonly` is the minimal, recommended pair (no
broad Drive access). While the consent screen stays in Testing mode, refresh tokens expire
after 7 days — publish the app (or keep it Internal in a Workspace domain) for long-lived tokens.

⚠️ The credentials are stored **in plain text** in your client's config — treat them like a
password. The refresh token grants access to your forms until revoked at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_FORMS_CLIENT_ID` | yes* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_FORMS_CLIENT_SECRET` | yes* | — | OAuth2 client secret (refresh flow). |
| `GOOGLE_FORMS_REFRESH_TOKEN` | yes* | — | OAuth2 refresh token (refresh flow). |
| `GOOGLE_FORMS_ACCESS_TOKEN` | yes* | — | Alternative: a static access token (~1 h lifetime), mostly for testing. |
| `GOOGLE_FORMS_API_BASE` | no | `https://forms.googleapis.com` | API root override. |
| `GOOGLE_FORMS_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_FORMS_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* Either the three refresh-flow variables together, **or** `GOOGLE_FORMS_ACCESS_TOKEN`.

## Documentation

- [All tools](https://github.com/A1-x-Tech/mcp-google-forms/blob/main/docs/TOOLS.md) — full reference with parameters and notes.
- [Development](https://github.com/A1-x-Tech/mcp-google-forms/blob/main/docs/DEVELOPMENT.md) — build, tests, smoke check, telemetry.
- [Publishing](https://github.com/A1-x-Tech/mcp-google-forms/blob/main/docs/PUBLISHING.md) — releasing and MCP-catalog listing.

## Support

Questions, ideas, issues — Telegram [@gistrec](http://t.me/gistrec) or
[GitHub issues](https://github.com/A1-x-Tech/mcp-google-forms/issues).

## License

MIT — see [LICENSE](./LICENSE).
