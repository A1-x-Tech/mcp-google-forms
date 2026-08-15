# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Forms MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/mcp-google-forms)](https://www.npmjs.com/package/mcp-google-forms)
[![CI](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Forms MCP** lets an AI app build and manage Google Forms in plain language. Create a survey, choose its questions, publish it when ready, read answers and use notifications for new submissions.

It uses the Google Forms API with your Google account. It distinguishes a draft form from a published form and makes the limits of the Forms API explicit instead of implying that every form task is possible.

- **13 tools.** Inspect form structure and responses, create and edit forms and questions, manage publishing, and configure Pub/Sub watches.
- **Publish deliberately.** Forms made through the API start unpublished, so they cannot collect responses until you publish them.
- **Responses stay intact.** The API can read responses but cannot create or edit them; the server has no tool that submits answers.
- **Minimal Google scopes.** It uses `forms.body` and `forms.responses.readonly`, without broad Drive access.

Start with a read-only question:

> Show me yesterday’s responses to the customer feedback form and summarize the free-text answers.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** Show me the questions and response settings of the customer feedback form.
>
> **Assistant:** Shows the form, its items, whether it is published and whether it accepts responses. Nothing changes.
>
> **You:** Prepare a required 1–5 rating question called “How was your experience?” after the first question.
>
> **Assistant:** Shows the target form, position and proposed question, then asks for confirmation before adding it.
>
> **You:** Confirm.
>
> **Assistant:** Adds the question to the form. It does not publish or close the form unless you ask separately.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How a form changes](#how-a-form-changes)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google account and OAuth credentials from a Google Cloud project with the Google Forms API enabled.

1. [Prepare Google OAuth access](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → Plugins → MCP servers**, select **Add server**, then add `npx -y mcp-google-forms@latest` with `GOOGLE_FORMS_CLIENT_ID`, `GOOGLE_FORMS_CLIENT_SECRET` and `GOOGLE_FORMS_REFRESH_TOKEN`.

**From the command line:**

```bash
codex mcp add google-forms \
  --env GOOGLE_FORMS_CLIENT_ID=your_client_id \
  --env GOOGLE_FORMS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_FORMS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y mcp-google-forms@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_FORMS_CLIENT_ID=your_client_id \
  --env GOOGLE_FORMS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_FORMS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-forms \
  -- npx -y mcp-google-forms@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Open **Settings → Developer → Edit Config** and add:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "mcp-google-forms@latest"],
      "env": {
        "GOOGLE_FORMS_CLIENT_ID": "your_client_id",
        "GOOGLE_FORMS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_FORMS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

If **Edit Config** is unavailable, edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-forms": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-forms@latest"],
      "env": {
        "GOOGLE_FORMS_CLIENT_ID": "your_client_id",
        "GOOGLE_FORMS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_FORMS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-forms": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-forms@latest"],
      "env": {
        "GOOGLE_FORMS_CLIENT_ID": "${input:forms_client_id}",
        "GOOGLE_FORMS_CLIENT_SECRET": "${input:forms_client_secret}",
        "GOOGLE_FORMS_REFRESH_TOKEN": "${input:forms_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "forms_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "forms_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "forms_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### Inspect a survey and its answers

- Show this form’s questions, response settings and responder link.
- How many answers arrived since Monday? Summarize the free-text feedback.
- Show one response by ID.

### Build and improve a form

- Create an RSVP form with name, meal preference and arrival date.
- Add a required rating, dropdown, date, time, choice or text question.
- Reorder a question or update a title, description, quiz mode or email collection.

### Publish and connect notifications

- Publish a prepared form and show its responder URL.
- Stop accepting new responses without deleting the form.
- Create, renew or remove a Cloud Pub/Sub watch for new submissions.

## How a form changes

1. `create_form` creates a **form**, which starts unpublished by default.
2. Questions are **items**, identified by their position in the form.
3. Publishing makes a form available to respondents; closing response collection leaves it published but stops new submissions.
4. Responses are a separate read-only record. The API cannot submit, edit or delete a respondent’s answer.

File-upload questions cannot be created through the Forms API, although existing file-upload items can be read. Legacy forms created before Google’s publish model may not support publishing settings.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Read a form and its responses | Reads form structure and submissions | No change |
| Create a form | Adds an unpublished form | Changes Google Forms |
| Add or move a question | Changes form items | Changes a form |
| Update form info, settings or an item | Changes title, settings or a selected question | Changes a form |
| Publish, unpublish, open or close responses | Changes who can use the form | Changes a form’s public availability |
| Delete an item | Removes a selected question | Destructive |
| Manage a Pub/Sub watch | Creates, renews or deletes notification delivery | Potentially destructive |
| Raw API request | Can call API methods without a dedicated tool | Potentially destructive |

The AI client controls confirmation prompts. The server marks reads, writes and destructive tools so the client can distinguish an inspection from a live change.

## Getting access

Google Forms requires OAuth 2.0; an API key is not enough.

1. Create or select a Google Cloud project and enable **Google Forms API**.
2. Configure the OAuth consent screen and create a **Desktop app** OAuth client.
3. Authorize the Google account that owns or can edit the forms. The [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) can obtain the refresh token when **Use your own OAuth credentials** is enabled.
4. Request both scopes:

   ```text
   https://www.googleapis.com/auth/forms.body
   https://www.googleapis.com/auth/forms.responses.readonly
   ```

Testing-mode OAuth refresh tokens can expire after seven days. Publish the OAuth app, or use an Internal app in a Workspace domain, when you need long-lived access. Treat the client secret and refresh token as passwords.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_FORMS_CLIENT_ID` | Yes* | OAuth client ID. |
| `GOOGLE_FORMS_CLIENT_SECRET` | Yes* | OAuth client secret. |
| `GOOGLE_FORMS_REFRESH_TOKEN` | Yes* | OAuth refresh token. |
| `GOOGLE_FORMS_ACCESS_TOKEN` | Yes* | Short-lived alternative to the OAuth trio. |
| `GOOGLE_FORMS_API_BASE` | No | Google Forms API base URL override. |
| `GOOGLE_FORMS_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_FORMS_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token.

## Data, limits and background work

- **Requests go to Google Forms.** The local server refreshes Google OAuth tokens and calls the Forms API. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, form data, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies per-minute quotas.** The documented limits are 975 reads per project, 450 `list_responses` calls and 375 writes. On `429`, the server uses backoff; reads also retry after network and `5xx` errors, while writes are not replayed after an uncertain failure.
- **There is no background polling.** The server runs only when called. Pub/Sub watches can notify your own infrastructure about new responses; if your AI app supports scheduled tasks, it can also check responses periodically.

## Technical documentation

- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Forms API reference](https://developers.google.com/forms/api)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-forms/issues) or write in [Telegram](https://t.me/a1_mcp).
