---
id: web-pages-object-social
title: Object page — Social tab
description: "Social center column: Posts, Threads, and Activity sub-tabs with compose entry points."
type: spec
status: active
scope: web
tags: [web, page, object, social]
updated_at: 2026-11-12
related:
  - docs/apps/web/spec/pages/object/page-shell.md
  - docs/apps/web/spec/pages/object/navigation.md
  - docs/apps/query-api/spec/object-posts-feed.md
  - docs/apps/query-api/spec/object-threads-feed.md
  - docs/apps/query-api/spec/osl-messaging.md
  - docs/apps/web/spec/activity-notes.md
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
  - Inline [`CompactComposeEditor`](../../../../../apps/web/src/modules/editor/presentation/components/compact-compose-editor.tsx) with placeholder `object_thread_compose_placeholder` — the same features as every editor; the body is `editorBodyToMarkdown` markdown (hashtags such as `#my_tag` stay unescaped).
- **Anchor object:** Not shown inside the editor. On send, [`appendObjectAnchorToThreadBody`](../../../../../apps/web/src/modules/object/domain/append-object-anchor-to-thread-body.ts) appends `#objectId` to the broadcast body (or `/object/{objectId}` when the id contains `.`) so chain-indexer `extractHashtags` indexes the object.
- **Broadcast:** Hive `comment` with `parent_author = leothreads`; parent permlink from server action [`resolveLeoThreadParentAction`](../../../../../apps/web/src/modules/object/infrastructure/actions/resolve-leo-thread-parent.action.ts) (Hive `get_discussions_by_blog`). After broadcast: `awaitTrxConfirmation` → `revalidateObjectAfterBroadcast`.
- **Empty feed:** No “Threads” heading — `empty_threads` message below compose.

## Activity

See [messaging.md](../../../messaging.md) — [`ObjectActivityComposeBar`](../../../../../apps/web/src/modules/messaging/presentation/object-activity-compose-bar.tsx) on the Activity sub-tab only. Mention cross-posts (object links in body) appear on linked objects' Activity feeds with a **From {name}** source link; reply/edit/delete on foreign rows use the source message's `channel_id`.

### Activity message permalink

Every activity message has a public URL: `/object/{objectId}/social/activity/{messageId}` (`messageId` = on-chain `message_id`, `{trxId}-{trxIndex}-{opIndex}-{eventIndex}`). Builder: `buildObjectActivityMessagePath` / `resolveActivityMessageHref` in [`activity-message-permalink.ts`](../../../../../apps/web/src/modules/messaging/domain/activity-message-permalink.ts).

| Surface | Behavior |
|---------|----------|
| Feed row | ↗ open icon beside the "…" menu (hover/focus on desktop, always visible on touch) — a real `<a href>` to the permalink. **Plain click** opens the preview modal; Ctrl/Cmd/Shift/middle click opens the full page in a new tab. "…" menu / long-press sheet adds **Copy link** (absolute URL). |
| Preview modal | [`ActivityMessagePreviewModal`](../../../../../apps/web/src/modules/messaging/presentation/activity-message-preview-modal.tsx) (`ModalShell`, post-modal layout): author, **From {name}**, full body with social embeds, caption. Pills: Close, Open full page, Copy link. Opening pushes the permalink (own history entry, feed stays mounted); Close / Esc / Back pops it ([`useActivityMessagePreview`](../../../../../apps/web/src/modules/messaging/presentation/use-activity-message-preview.ts)). Social > Activity stays selected while the permalink is in the address bar. |
| Full page | Direct visit or refresh: [`proxy.ts`](../../../../../apps/web/src/proxy.ts) rewrites to `?tab=social&social_sub=activity&activity_message_id=…`; the Activity slot renders [`ObjectPageActivityMessageSection`](../../../../../apps/web/src/app/(app)/object/[object-id]/object-page-activity-message-section.server.tsx) — **← All activity** link + the single message (read-only, Copy link kept). Unknown, unlinked or muted message → `notFound()`. Metadata: `{author} · {object} · Activity`, description = plain-text body excerpt; canonical and image stay the object's. |
| Home Activity feed | Same open icon and preview; the row's own object (`source_object`) builds the URL. [`HomeFeedScrollReset`](../../../../../apps/web/src/modules/home/presentation/components/home-feed-scroll-reset.tsx) ignores permalink pathnames so the feed keeps its scroll position. |

**Private notes:** the full page also shows the viewer's private notes on the message and the agent import banner (`#note=…`) — see [activity-notes.md](../../../activity-notes.md).

Data: `GET /query/v1/objects/{objectId}/channel/messages/{messageId}` ([osl-messaging.md](../../../../../query-api/spec/osl-messaging.md)), cache tag `objectChannelMessages(objectId)` (revalidated after edit/delete broadcasts).

## Verification

```bash
pnpm nx test web --testPathPatterns="object-primary-content|object-write-post|object-thread|append-object-anchor|object-activity-feed-list|activity-message|activity-notes|activity-note-|object-page-search|proxy.spec"
pnpm typecheck:web
```
