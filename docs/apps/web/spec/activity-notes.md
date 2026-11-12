---
id: web-activity-notes
title: Private notes on activity messages
description: "Per-viewer private notes under an activity message permalink, plus the one-shot agent import link (`#note=…`)."
type: spec
status: active
scope: web
tags: [web, messaging, notes, agent]
updated_at: 2026-11-12
related:
  - docs/apps/web/spec/pages/object/routes/social.md
  - docs/apps/web/spec/components/code-block-copy.md
  - docs/apps/query-api/spec/activity-message-notes.md
---

# Private notes on activity messages

**Back:** [Social tab → Activity message permalink](pages/object/routes/social.md#activity-message-permalink)

A signed-in viewer can keep up to **10** private markdown notes (each up to **20 000** characters) on one activity message. Only the owner of the access token sees them. An agent hands a note to a human with an **import link**; nothing is stored until the human clicks **Save to my notes**.

Module: [`apps/web/src/modules/activity-notes/`](../../../../apps/web/src/modules/activity-notes/) · API: [query-api activity-message-notes](../../query-api/spec/activity-message-notes.md).

## Where

Only on the full permalink page `/object/{objectId}/social/activity/{messageId}` (not in the feed or the preview modal). Below the message:

1. **Import banner** — everyone, only when the URL hash carries a note.
2. **My notes · n/10** — signed-in viewers only.

Notes are keyed by `message_id`, so a cross-posted message shows the same notes on every object.

## Notes section

| Element | Behavior |
|---------|----------|
| Header | **My notes · n/10**, "Only you can see these notes", **Delete all** (when n > 0) → `AppModal` confirm |
| Note card | Markdown → `sanitizePostBodyHtml` → `SocialEmbedHtml` (same pipeline as activity messages); code blocks wrap and get a [Copy button](components/code-block-copy.md). **Edit** / **Delete** |
| Edit | Card turns into the composer seeded with the note markdown; **Save note** / **Cancel** |
| Add | Composer at the bottom; hidden at 10/10 with the limit hint |
| Errors | Inline `role="alert"`: limit reached, sign-in needed, or a generic retry message |

Composer: the shared `CompactComposeEditor` (same features as every editor) → `editorBodyToMarkdown`, like the Activity compose bar; `#` object search for the signed-in owner. The edit seed is imported as markdown (code fences, bold, lists stay intact). Note bodies render with `COMPACT_BODY_BLOCK_CLASSES`, plus wrapping code lines.

Data flow:

- RSC: [`ObjectPageActivityMessageSection`](../../../../apps/web/src/app/(app)/object/[object-id]/object-page-activity-message-section.server.tsx) loads the message and, for a signed-in viewer, `fetchActivityNotesServer(messageId)` in parallel (request-time, `no-store`). A missing or rejected token resolves to an empty list.
- Client: [`ActivityNotesPanel`](../../../../apps/web/src/modules/activity-notes/presentation/activity-notes-panel.tsx) keeps the list in local state seeded from props and re-synced when the server props change (`router.refresh`, e.g. after login). Mutations update it from action results.
- Server Actions ([`activity-notes.actions.ts`](../../../../apps/web/src/modules/activity-notes/infrastructure/activity-notes.actions.ts)): create, update, delete, delete all. They validate input with Zod and return `Result<…, { code }>` with `unauthorized | limit_reached | not_found | invalid | network | http_error`; they never throw. Transport: `queryApiAuthedFetch` (Bearer from the `odl_access` cookie; error body `code` surfaced as `apiCode`, so 409 `activity_notes_limit_reached` maps to `limit_reached`).

## Import link (agent contract)

The agent never uses the human's token. It builds a link to the permalink page with the note in the **hash** (never sent to the server):

```
/object/{objectId}/social/activity/{messageId}#note={encodeURIComponent(markdown)}
```

agent-wallet tool `activity_note_import_link` builds it. Parsing: [`parseActivityNoteImportHash`](../../../../apps/web/src/modules/activity-notes/domain/parse-activity-note-import-hash.ts) — strip the leading `#`, read with `URLSearchParams` (so a literal `+` means a space; `encodeURIComponent` output is safe).

| Hash | Note markdown |
|------|---------------|
| `note=<markdown>` | That markdown, trimmed. If `note` is present it wins over `top` / `v` |
| `top=<markdown>&v=<text>&v=<text>…` (legacy customer form) | `top` (optional), a blank line, then per non-blank `v` (labels A, B, C, …): `**A**`, newline, a fenced code block with the `v` text exactly. Fence = max(3, longest backtick run + 1) backticks. Blocks are separated by blank lines |
| anything else | no banner |

The result is trimmed; empty or longer than 20 000 characters → no banner.

**Write copyable text in ``` fences.** Every rendered code block gets a Copy button, so each comment variant should be its own fenced block, with the reasoning outside the fences.

### Banner

[`ActivityNoteImportBanner`](../../../../apps/web/src/modules/activity-notes/presentation/activity-note-import-banner.tsx) reads `window.location.hash` in `useEffect` (and on `hashchange`), so SSR and hydration never see it.

| Action | Result |
|--------|--------|
| **Save to my notes** (signed in) | `createActivityNoteAction` → note appended to *My notes*, hash removed |
| **Save to my notes** (signed out) | Opens the login modal; the hash stays, so Save works after login |
| **Dismiss** | Hash removed, nothing stored |
| Limit / other error | Banner stays with an inline alert |

The hash is removed with `history.replaceState(history.state, '', pathname + search)`, which keeps Next's history state (`__NA`).

### Security

- The link text is visible to anyone who has the link (and to browser history / extensions on that device). It is not secret.
- Only **saved** notes are private. Saving creates a copy under the viewer's own account; the server enforces ownership on every read and write.
- The note body renders through `sanitizePostBodyHtml`, like any user markdown.

## Verification

```bash
pnpm nx test web --testPathPatterns="activity-notes|activity-note-|use-code-block-copy-buttons|query-api-authed-fetch"
pnpm typecheck:web
```
