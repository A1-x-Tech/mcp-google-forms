# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Forms MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/mcp-google-forms)](https://www.npmjs.com/package/mcp-google-forms)
[![CI](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-forms/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-forms)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Forms MCP** позволяет AI-приложению создавать и настраивать Google Forms обычным языком. Можно подготовить опрос, выбрать вопросы, опубликовать его в нужный момент, прочитать ответы и настроить уведомления о новых отправках.

Сервер работает с Google Forms API через ваш Google-аккаунт. Он отличает черновую форму от опубликованной и явно показывает ограничения API, а не создаёт впечатление, что через форму можно сделать всё.

- **13 инструментов.** Проверка структуры формы и ответов, создание и редактирование форм и вопросов, управление публикацией и Pub/Sub watches.
- **Осознанная публикация.** Формы, созданные через API, по умолчанию не опубликованы и не принимают ответы, пока вы их не опубликуете.
- **Ответы сохраняются как есть.** API умеет читать ответы, но не создавать и не редактировать их; инструмента отправки ответов у сервера нет.
- **Минимальные scope Google.** Используются `forms.body` и `forms.responses.readonly` без широкого доступа к Drive.

Начните с запроса, который только читает данные:

> Покажи вчерашние ответы на форму обратной связи и кратко суммируй ответы в свободной форме.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Покажи вопросы и настройки приёма ответов в форме обратной связи.
>
> **Ассистент:** Показывает форму, её пункты, статус публикации и возможность принимать ответы. Ничего не меняется.
>
> **Вы:** Подготовь обязательный вопрос с оценкой от 1 до 5: «Как прошёл ваш опыт?» — после первого вопроса.
>
> **Ассистент:** Показывает целевую форму, позицию и предлагаемый вопрос, затем запрашивает подтверждение перед добавлением.
>
> **Вы:** Подтверждаю.
>
> **Ассистент:** Добавляет вопрос в форму. Он не публикует и не закрывает форму, пока вы не попросите об этом отдельно.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как меняется форма](#как-меняется-форма)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, Google-аккаунт и OAuth-данные из проекта Google Cloud с включённым Google Forms API.

1. [Подготовьте Google OAuth-доступ](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → Plugins → MCP servers**, нажмите **Add server**, затем добавьте `npx -y mcp-google-forms@latest` с `GOOGLE_FORMS_CLIENT_ID`, `GOOGLE_FORMS_CLIENT_SECRET` и `GOOGLE_FORMS_REFRESH_TOKEN`.

**В командной строке:**

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

[Документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

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

[Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Откройте **Settings → Developer → Edit Config** и добавьте:

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

Если **Edit Config** недоступна, отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` на macOS или `%APPDATA%\Claude\claude_desktop_config.json` на Windows.

[Документация Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Добавьте в `~/.cursor/mcp.json` на macOS/Linux или `%USERPROFILE%\.cursor\mcp.json` на Windows:

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

[Документация Cursor MCP](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Запустите **MCP: Open User Configuration** и добавьте:

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

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Проверить опрос и ответы

- Покажи вопросы, настройки приёма ответов и ссылку для респондентов.
- Сколько ответов пришло с понедельника? Суммируй обратную связь в свободной форме.
- Покажи один ответ по его ID.

### Собрать и улучшить форму

- Создай RSVP-форму с именем, выбором питания и датой приезда.
- Добавь обязательный вопрос с оценкой, выпадающий список, дату, время, один или несколько вариантов или текстовое поле.
- Перемести вопрос или обнови название, описание, quiz mode или сбор email.

### Опубликовать и настроить уведомления

- Опубликуй готовую форму и покажи ссылку для респондентов.
- Останови приём новых ответов, не удаляя форму.
- Создай, продли или удали Cloud Pub/Sub watch для новых отправок.

## Как меняется форма

1. `create_form` создаёт **форму**, которая по умолчанию не опубликована.
2. Вопросы — это **пункты**, которые определяются позицией в форме.
3. Публикация открывает форму для респондентов; закрытие приёма ответов оставляет форму опубликованной, но не принимает новые отправки.
4. Ответы — отдельная read-only запись. API не может отправить, изменить или удалить ответ респондента.

Через Forms API нельзя создать вопрос с загрузкой файла, хотя существующий такой вопрос можно прочитать. Старые формы, созданные до модели публикации Google, могут не поддерживать настройки публикации.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Проверка формы и её ответов | Читает структуру и отправки | Ничего не меняет |
| Создание формы | Добавляет неопубликованную форму | Меняет Google Forms |
| Добавление или перемещение вопроса | Меняет пункты формы | Меняет форму |
| Обновление данных, настроек или вопроса | Меняет название, настройки или выбранный вопрос | Меняет форму |
| Публикация, снятие с публикации, открытие или закрытие ответов | Меняет доступность формы | Меняет доступ для респондентов |
| Удаление пункта | Удаляет выбранный вопрос | Разрушительно |
| Управление Pub/Sub watch | Создаёт, продлевает или удаляет доставку уведомлений | Потенциально разрушительно |
| Технический запрос API | Может вызвать метод API без отдельного инструмента | Потенциально разрушительно |

Как AI-приложение просит подтверждение, определяет само приложение. Сервер помечает операции чтения, записи и удаления, чтобы оно отличило проверку от рабочего изменения.

## Как получить доступ

Google Forms требует OAuth 2.0: одного API-ключа недостаточно.

1. Создайте или выберите проект Google Cloud и включите **Google Forms API**.
2. Настройте OAuth consent screen и создайте OAuth-клиент типа **Desktop app**.
3. Авторизуйте Google-аккаунт, который владеет формами или может их редактировать. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) поможет получить refresh token, если включить **Use your own OAuth credentials**.
4. Запросите оба scope:

   ```text
   https://www.googleapis.com/auth/forms.body
   https://www.googleapis.com/auth/forms.responses.readonly
   ```

Refresh token OAuth-приложения в режиме Testing может истечь через семь дней. Для долгого доступа опубликуйте OAuth-приложение или используйте Internal-приложение в домене Workspace. Храните client secret и refresh token как пароли.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_FORMS_CLIENT_ID` | Да* | OAuth client ID. |
| `GOOGLE_FORMS_CLIENT_SECRET` | Да* | OAuth client secret. |
| `GOOGLE_FORMS_REFRESH_TOKEN` | Да* | OAuth refresh token. |
| `GOOGLE_FORMS_ACCESS_TOKEN` | Да* | Короткоживущая альтернатива OAuth-тройке. |
| `GOOGLE_FORMS_API_BASE` | Нет | Переопределяет базовый URL Google Forms API. |
| `GOOGLE_FORMS_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `60000` мс. |
| `GOOGLE_FORMS_MAX_RETRIES` | Нет | Повторы временных ошибок; по умолчанию `3`. |

\* Передайте OAuth-тройку или access token.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google Forms.** Локальный сервер обновляет OAuth-токены Google и вызывает Forms API. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не OAuth-токены, данные формы, аргументы или промпты. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть поминутные квоты.** Документированные лимиты: 975 чтений на проект, 450 вызовов `list_responses` и 375 записей. При `429` сервер использует задержку; чтение также повторяется после сетевых и `5xx` ошибок, а запись после неопределённой ошибки не повторяется.
- **Постоянного опроса нет.** Сервер работает только при вызове. Pub/Sub watch может уведомить вашу инфраструктуру о новых ответах; если AI-приложение поддерживает задания по расписанию, оно также может периодически проверять ответы.

## Техническая документация

- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Google Forms API](https://developers.google.com/forms/api)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-forms/issues) или напишите в [Telegram](https://t.me/a1_mcp).
