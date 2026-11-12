---
id: docs-apps-query-api-spec-activity-message-notes
title: Activity message notes
description: Private per-account notes on activity messages, stored in `activity_message_notes` and visible only to the JWT subject.
type: spec
status: active
scope: query-api
tags: [query-api, activity-message-notes, messaging]
updated_at: 2026-11-12
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/osl-messaging.md
  - docs/spec/data-model/messages.md
---

# Activity message notes (authenticated)

**Back:** [query-api overview](overview.md) · **Data model:** [messages.md](../../../spec/data-model/messages.md#activity-message-notes-private-per-account)

Private notes that an account keeps on one activity message (e.g. comment drafts prepared by an agent). Notes live in PostgreSQL table `activity_message_notes`; they are never broadcast on chain.

## Authentication and ownership

All routes require **`Authorization: Bearer <access_token>`** (auth-api access JWT, same `JWT_SECRET`). Missing or invalid token: **401**.

There is no account segment in the path. The owner is always the token subject: `author = normalizeHiveAccount(sub)` (trim + lowercase). Every SQL query filters on `author`, so another account's note is indistinguishable from an unknown note (**404**). GET returns only the caller's notes.

Not exposed through MCP (`POST /query/mcp` is unauthenticated; see [MCP](mcp.md)).

## HTTP

Base path: **`/query/v1/messages/:messageId/notes`**.

| Method | Path | Body | Success | Errors |
|--------|------|------|---------|--------|
| `GET` | `/messages/:messageId/notes` | — | **200** `{ items: NoteView[], limit: 10 }` (oldest first) | 400, 401 |
| `POST` | `/messages/:messageId/notes` | `{ body }` | **201** `NoteView` | 400, 401, 404 `activity_message_not_found`, 409 `activity_notes_limit_reached` |
| `PATCH` | `/messages/:messageId/notes/:noteId` | `{ body }` | **200** `NoteView` | 400, 401, 404 `activity_note_not_found` |
| `DELETE` | `/messages/:messageId/notes/:noteId` | — | **204** | 400, 401, 404 `activity_note_not_found` |
| `DELETE` | `/messages/:messageId/notes` | — | **204** (all caller notes on the message; also when none) | 400, 401 |

`NoteView`: `{ noteId: string (uuid), messageId: string, body: string, createdAt: ISO string, updatedAt: ISO string }`.

GET on an unknown message returns `{ items: [], limit: 10 }` (no 404).

Error bodies for 404/409 carry a machine-readable `code`: `{ "message": "…", "code": "activity_notes_limit_reached" }`.

## Validation

| Input | Rule |
|-------|------|
| `messageId` | trimmed string, 1..256 chars |
| `noteId` | UUID |
| body | `{ body }` only (`.strict()`); `body` trimmed, 1..20 000 chars (markdown) |

Invalid params or body: **400** from the Zod pipes.

## Limits and concurrency

- At most **10** notes per account per message (`ACTIVITY_NOTES_MAX_PER_MESSAGE`).
- Create runs in one transaction: `pg_advisory_xact_lock` on (author, message) → message exists → count → insert. Two parallel creates for the last slot cannot both succeed.

## Lifecycle

- Notes are keyed by `message_id`, not by object: a cross-posted message shows the same notes on every object.
- `message_id` references `messages` with `ON DELETE CASCADE`; when chain-indexer deletes a message (tombstone), its notes are removed.

## Code

| Layer | Path |
|-------|------|
| Controller | `apps/query-api/src/controllers/activity-message-notes.controller.ts` |
| Service, schemas, errors | `apps/query-api/src/domain/activity-notes/` |
| Repository | `apps/query-api/src/repositories/activity-message-notes.repository.ts` |
| OpenAPI | `apps/query-api/src/openapi/activity-message-notes.openapi.ts` |
| Migration | `libs/migrations/src/postgres/odl/00074_activity_message_notes.ts` |

## Verification

```bash
pnpm nx test query-api --testPathPatterns="activity-(notes|message-notes)"
POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test query-api --testPathPatterns=activity-message-notes.repository.db
```

The DB spec needs the disposable test Postgres (`pnpm test:db:up`, see [test Postgres harness](../../../standards/test-postgres-harness.md)).
