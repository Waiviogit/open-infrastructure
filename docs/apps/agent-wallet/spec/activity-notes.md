---
id: docs-apps-agent-wallet-spec-activity-notes
title: Activity notes (import link + agent's own notes)
description: MCP tools that hand a markdown note to a human via an import link, and keep optional private notes under the agent's own account.
type: spec
status: active
scope: agent-wallet
tags: [agent-wallet, mcp, activity, notes, query-api]
updated_at: 2026-11-12
related:
  - docs/apps/agent-wallet/spec/overview.md
  - docs/apps/query-api/spec/activity-message-notes.md
  - docs/apps/web/spec/activity-notes.md
---

# Activity notes

Notes are private markdown notes attached to one object activity item (an OSL `messages` row). query-api stores them per author; the web shows them on the activity permalink.

Agent playbook: skill `activity-comment-drafts` (`npx skills add https://github.com/Waiviogit/skills`).

## Account model

- The agent works **only under its own account** (e.g. `neo.agent`). It never asks for, receives or uses the human's token, and never logs into the human's account.
- **Handoff to a human = import link.** `activity_note_import_link` builds a URL; the human opens it, previews the note and clicks "Save to my notes", which stores a copy under the human's account. Nothing is saved until they click.
- **Agent's own notes are optional** storage for the agent itself (`activity_notes_*`). They are private to the agent's account and invisible to humans.

## `activity_note_import_link`

Pure helper (`domain/activity-note-import-link.ts`): no auth, no network, no broadcast.

| Input | Notes |
|-------|-------|
| `objectId` | ODL object id that owns the activity item |
| `messageId` | Activity permalink id from query-api activity messages |
| `body` | Markdown; trimmed; 1..20000 characters, else a clear error |

Output: `{ url, urlLength, bodyLength }` with

```
{WAIVIO_WEB_ORIGIN}/object/{encodeURIComponent(objectId)}/social/activity/{encodeURIComponent(messageId)}#note={encodeURIComponent(body)}
```

The web reads the hash with `URLSearchParams` and takes `note` verbatim (trimmed) — contract in [web activity notes](../../web/spec/activity-notes.md). The note travels inside the link, so anyone with the link can read it. Very long URLs (over ~8000 characters) can be cut by chat apps; split into several notes.

## Agent's own notes (`activity_notes_*`)

`ActivityNotesClientService` (`domain/activity-notes-client.service.ts`) calls query-api [activity message notes](../../query-api/spec/activity-message-notes.md) at `${QUERY_API_ORIGIN}/query/v1/messages/{messageId}/notes` with `Authorization: Bearer <Waivio access token>` from `WaivioAuthSessionService` (same mechanism as `ipfs_upload_image`). The token never leaves the process. On 401 it refreshes the token and retries once.

| Tool | Input | Returns |
|------|-------|---------|
| `activity_notes_list` | `messageId`, `account?` | `{ items: NoteView[], limit }` |
| `activity_notes_create` | `messageId`, `body`, `account?` | `NoteView` |
| `activity_notes_update` | `messageId`, `noteId` (uuid), `body`, `account?` | `NoteView` |
| `activity_notes_delete` | `messageId`, `noteId`, `account?` | `{ deleted: true }` |
| `activity_notes_delete_all` | `messageId`, `account?` | `{ deletedAll: true }` |

`NoteView` = `{ noteId, messageId, body, createdAt, updatedAt }`, validated with Zod. `account` is the agent's registry account (default: configured account) and needs an active Waivio session (`waivio_auth_start`).

Errors (tool `isError` text):

| HTTP | Error class | Meaning |
|------|-------------|---------|
| 401 after retry | `ActivityNotesUnauthorizedError` | Waivio token rejected — rerun `waivio_auth_start` |
| 404 `activity_message_not_found` | `ActivityMessageNotFoundError` | Unknown `messageId` |
| 404 `activity_note_not_found` | `ActivityNoteNotFoundError` | Unknown `noteId` or another account's note |
| 409 `activity_notes_limit_reached` | `ActivityNotesLimitReachedError` | 10 notes per item per account |
| 404 without a code | `ActivityNotesApiError` | Route not served — check `QUERY_API_ORIGIN` |

## Configuration

| Variable | Default | Used by |
|----------|---------|---------|
| `QUERY_API_ORIGIN` | `WAIVIO_API_ORIGIN` | `activity_notes_*` (`/query/v1` base) |
| `WAIVIO_WEB_ORIGIN` | `WAIVIO_API_ORIGIN` | `activity_note_import_link` |

> **Gateway:** the public nginx template (`nginx/conf.d/default.conf.template`) proxies only `= /query/mcp` to query-api; `/query/v1/*` falls through to the web app. Until the gateway routes `/query/v1/`, set `QUERY_API_ORIGIN` to an origin that serves query-api REST directly, or `activity_notes_*` fail with the 404 routing hint. `activity_note_import_link` is unaffected.

## Verification

```bash
pnpm nx test agent-wallet   # activity-notes-client.service.spec.ts, activity-note-import-link.spec.ts
```
