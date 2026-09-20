# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Forms MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/mcp-google-forms)](https://www.npmjs.com/package/mcp-google-forms)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms)
[![CI](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Forms MCP** lets an AI app build and manage Google Forms in plain language. Create a survey, choose its questions, publish it when ready, read answers and use notifications for new submissions.

It uses the Google Forms API with your Google account. It distinguishes a draft form from a published form and makes the limits of the Forms API explicit instead of implying that every form task is possible.

- **19 tools.** Inspect form structure and responses, create and edit forms and questions, manage publishing, and configure Pub/Sub watches.
- **Connects from the conversation.** Say "connect Google Forms": the server walks you through the OAuth client, catches Google's redirect on `127.0.0.1` with PKCE and keeps the tokens itself — no config files, no restart.
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

You need Node.js 20+ and a Google account. Credentials are not required at install time — the server connects from the conversation.

1. Add the server to your AI app.
2. Say "connect Google Forms": the assistant walks you through [creating the OAuth client and approving access](#getting-access) without editing config files.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → MCP servers**, select **Add server**, choose **STDIO**, enter the command `npx -y mcp-google-forms@latest` and environment variables `GOOGLE_FORMS_CLIENT_ID`, `GOOGLE_FORMS_CLIENT_SECRET`, `GOOGLE_FORMS_REFRESH_TOKEN`, then select **Save** and **Restart**.

**From the command line:**

```bash
codex mcp add google-forms \
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

The current official path is **Settings → Extensions**. For a custom desktop extension, open **Advanced settings → Extension Developer → Install Extension…**, select a `.mcpb` file and follow the prompts.

This repository currently publishes an npm stdio package and does not contain a `.mcpb` bundle. For Claude Desktop builds that still support local configuration, use the following JSON stdio configuration as a fallback:

```json
{
  "mcpServers": {
    "google-forms": {
      "command": "npx",
      "args": ["-y", "mcp-google-forms@latest"]
    }
  }
}
```

In those builds, save it to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

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
      "args": ["-y", "mcp-google-forms@latest"]
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
      "args": ["-y", "mcp-google-forms@latest"]
    }
  }
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

Google Forms requires OAuth 2.0; an API key is not enough. There are two ways in, and the first one needs no configuration files.

### Connect from the chat (recommended)

Say "connect Google Forms" and the assistant runs the flow with you:

1. `setup_instructions` prints the checklist: create or select a Google Cloud project, enable **Google Forms API**, configure the consent screen and create a **Desktop app** OAuth client.
2. Download that client's JSON ("Download JSON") and give the assistant its **path** — `set_client` stores it owner-only. The secret never goes through the conversation.
3. `start_login` returns a Google consent link. Open it **on this machine** and approve; the code comes back to a one-shot listener on `127.0.0.1` (PKCE), never through the chat.
4. `finish_login` exchanges the code and saves the tokens to `~/.config/mcp-google-forms/credentials.json` (mode 0600).

The tokens are re-read on every call, so the connection works immediately — no restart of the AI app. `auth_status` shows what is connected, `logout` revokes and deletes it.

### Environment variables (CI, unattended installs)

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

Every variable is optional — with none of them the server connects [from the chat](#connect-from-the-chat-recommended).

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_FORMS_CLIENT_ID` | No* | OAuth client ID. |
| `GOOGLE_FORMS_CLIENT_SECRET` | No* | OAuth client secret. |
| `GOOGLE_FORMS_REFRESH_TOKEN` | No* | OAuth refresh token. |
| `GOOGLE_FORMS_ACCESS_TOKEN` | No* | Short-lived alternative to the OAuth trio. |
| `GOOGLE_FORMS_OAUTH_PORT` | No | Fixed loopback port for the in-chat login; useful over SSH port forwarding. |
| `GOOGLE_FORMS_API_BASE` | No | Google Forms API base URL override. |
| `GOOGLE_FORMS_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_FORMS_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token.

## Data, limits and background work

- **Requests go to Google Forms.** The local server refreshes Google OAuth tokens and calls the Forms API. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, form data, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies per-minute quotas.** The documented limits are 975 reads per project, 450 `list_responses` calls and 375 writes. On `429`, the server uses backoff; reads also retry after network and `5xx` errors, while writes are not replayed after an uncertain failure.
- **There is no background polling.** The server runs only when called. Pub/Sub watches can notify your own infrastructure about new responses; if your AI app supports scheduled tasks, it can also check responses periodically.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Forms API reference](https://developers.google.com/forms/api)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-forms/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
