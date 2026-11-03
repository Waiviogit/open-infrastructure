---
id: web-pages-object-social
title: Object page — Social tab
description: "Social center column: Posts, Threads, and Activity sub-tabs with compose entry points."
type: spec
status: active
scope: web
tags: [web, page, object, social]
updated_at: 2026-11-03
related:
  - docs/apps/web/spec/pages/object/page-shell.md
  - docs/apps/web/spec/pages/object/navigation.md
  - docs/apps/query-api/spec/object-posts-feed.md
  - docs/apps/query-api/spec/object-threads-feed.md
---

# Object page — Social tab

**Back:** [page-shell.md](../page-shell.md) · [navigation.md](../navigation.md)

## Sub-tabs

| Sub-tab | URL param | Content |
|---------|-----------|---------|
| Posts | `social_sub=posts` (default) | Object-linked Hive posts feed |
| Threads | `social_sub=threads` | Leo threads whose `hashtags` contain the object id |
| Activity | `social_sub=activity` | OSL object channel messages |

Shell: [`ObjectPrimaryContent`](../../../../../apps/web/src/modules/object/presentation/components/object-primary-content.tsx) + [`ObjectFeedSubNav`](../../../../../apps/web/src/modules/object/presentation/components/object-feed-sub-nav.tsx).

## Posts compose

- **When:** Social > **Posts** only (not Threads or Activity).
- **Placement:** Below the Posts/Threads/Activity sub-nav, above the feed.
- **UI:** [`ObjectWritePostPrompt`](../../../../../apps/web/src/modules/object/presentation/components/object-write-post-prompt.tsx) — pen icon, `object_social_write_post` i18n ("Write a post"), links to `/editor?attachObject={objectId}`.
- **Empty feed:** No redundant heading — muted `object_social_empty_posts` ("No posts yet.") only.

## Threads compose

- **When:** Social > **Threads** only.
- **Placement:** Below sub-nav, above the threads feed (including empty state).
- **UI:** [`ObjectThreadComposeBar`](../../../../../apps/web/src/modules/object/presentation/components/object-thread-compose-bar.tsx):
  - Non-removable **Posting in:** chip ([`ObjectThreadAnchorChip`](../../../../../apps/web/src/modules/object/presentation/components/object-thread-anchor-chip.tsx)) — discover-style pill + object name (no thumbnail).
  - Inline [`CompactComposeEditor`](../../../../../apps/web/src/modules/editor/presentation/components/compact-compose-editor.tsx) with placeholder `object_thread_compose_placeholder`.
- **Anchor object:** Not shown inside the editor. On send, [`appendObjectAnchorToThreadBody`](../../../../../apps/web/src/modules/object/domain/append-object-anchor-to-thread-body.ts) appends `#objectId` to the broadcast body (or `/object/{objectId}` when the id contains `.`) so chain-indexer `extractHashtags` indexes the object.
- **Broadcast:** Hive `comment` with `parent_author = leothreads`; parent permlink from server action [`resolveLeoThreadParentAction`](../../../../../apps/web/src/modules/object/infrastructure/actions/resolve-leo-thread-parent.action.ts) (Hive `get_discussions_by_blog`). After broadcast: `awaitTrxConfirmation` → `revalidateObjectAfterBroadcast`.
- **Empty feed:** No “Threads” heading — `empty_threads` message below compose.

## Activity

See [messaging.md](../../../messaging.md) — [`ObjectActivityComposeBar`](../../../../../apps/web/src/modules/messaging/presentation/object-activity-compose-bar.tsx) on the Activity sub-tab only. Mention cross-posts (object links in body) appear on linked objects' Activity feeds with a **From {name}** source link; reply/edit/delete on foreign rows use the source message's `channel_id`.

## Verification

```bash
pnpm nx test web --testPathPatterns="object-primary-content|object-write-post|object-thread|append-object-anchor"
pnpm typecheck:web
```
