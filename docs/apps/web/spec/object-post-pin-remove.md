---
id: web-object-post-pin-remove
title: Object post Pin / Remove
description: Pin, unpin and remove posts on an object's Posts feed from the story ⋯ menu, and the Reviews (Pin / Remove) fields in the object edit rail.
type: spec
status: active
scope: web
tags: [web, object-page, feed]
updated_at: 2026-11-17
related:
  - docs/apps/web/spec/overview.md
  - docs/apps/web/spec/components/story-overflow-menu.md
  - docs/apps/query-api/spec/object-posts-feed.md
---

# Object post Pin / Remove

**Back:** [web overview](overview.md) · **Related:** [story overflow menu](components/story-overflow-menu.md), [query-api object posts feed](../../query-api/spec/object-posts-feed.md)

## Scope

Posts tab of `/object/:id` (`ObjectPostsFeedList`) only. Threads, Activity, the mobile social preview and user feeds do not get these actions.

## Data

Object updates `pin` and `remove`; value `author/permlink` (`postRefSchema` in `@opden-data-layer/core`). Supported by every object type except `governance` and `legal-document`.

Per post the feed returns `pin`, `viewerPinned`, `pinUpdateId`, `removeUpdateId` (see the query-api spec for selection, cap and order).

## Story ⋯ menu

Shown to every viewer on the Posts tab; logged-out clicks open **Sign in**. Root posts only.

| Item | When | Broadcast |
|------|------|-----------|
| **Pin** | `viewerPinned` false | No `pinUpdateId` → `update_create pin`; else `update_vote for` on it |
| **Unpin** | `viewerPinned` true | `update_vote against` on `pinUpdateId` |
| **Remove** | always, after a confirm dialog | No `removeUpdateId` → `update_create remove`; else `update_vote for` on it |

The indexer skips a second `update_create` with the same value, so an existing update always gets a vote. After the wallet broadcast: Pin / Unpin flip the **Pinned** badge optimistically, Remove drops the card from the list; then `awaitTrxConfirmation` → `refreshAfterBroadcast` → `revalidateObjectAfterBroadcast`.

Pinned posts show a **Pinned** badge before the post time.

## Edit rail

`pin` and `remove` sit in the core edit group `reviews` (heading **REVIEWS**). The add-update form takes a post link (any `…/@author/permlink`) or `author/permlink` and stores `author/permlink` (`postRefFromInput`).

## Code

| Area | Location |
|------|----------|
| Op choice (create vs vote) | `apps/web/src/modules/feed/domain/object-post-review.ts` |
| Broadcast hook | `apps/web/src/modules/feed/presentation/hooks/use-object-post-review.ts` |
| Menu rows | `apps/web/src/modules/feed/presentation/components/story-overflow-menu.tsx` |
| Remove confirm | `apps/web/src/modules/feed/presentation/components/object-post-remove-modal.tsx` |
| Feed host | `apps/web/src/app/(app)/object/[object-id]/object-posts-feed-list.tsx` |
| Add-update input | `apps/web/src/modules/object-updates/presentation/components/post-ref-field.tsx` |
| i18n keys | `object_post_*`, `object_edit_group_reviews` |

## Legacy differences

- Legacy Waivio also voted an `administrative` authority for the pinner; not ported (validity is governance-resolved).
- Legacy fetched pinned posts in a second request; the Posts feed returns them on page 1.

## Verification

```bash
pnpm nx test web --testPathPatterns="object-post-review|story-overflow-menu|update-value-form.utils"
```
