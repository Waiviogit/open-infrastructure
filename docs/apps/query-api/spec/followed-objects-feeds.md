---
id: docs-apps-query-api-spec-followed-objects-feeds
title: Followed objects feeds (threads, updates)
description: POST /query/v1/users/:name/following-objects/threads and /updates — merged threads and object updates across every active object a profile follows.
type: spec
status: active
scope: query-api
tags: [query-api, followed-objects, threads, object-updates, hub-feed]
updated_at: 2026-11-06
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/object-threads-feed.md
  - docs/apps/query-api/spec/osl-messaging.md
  - docs/apps/web/spec/pages/home/feed-tabs.md
---

# Followed objects feeds

Two keyset feeds that merge content across every object `{name}` follows. They back the hub **Threads** and **Updates** tabs ([web spec](../../web/spec/pages/home/feed-tabs.md)). The **Activity** tab uses the existing `POST .../following-objects/messages` ([osl-messaging.md](osl-messaging.md)).

"Followed objects" = rows of `user_object_follows` where `account = {name}`, joined to `objects_core` with `status = 'active'`. Favorites and ownership do **not** count (unlike the personalized [home feed](home-feed.md)).

## Shared request

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | int 1–50 | 20 | Page size |
| `cursor` | string | — | Opaque cursor from the previous page; malformed → empty page |

Headers: `X-Viewer` (mutes on threads, viewer vote state), `X-Governance-Object-Id`, `Accept-Language` / `X-Locale` (object name resolution). The headers never change whose follows are read.

Unknown `{name}` (not in `accounts_current`) → `404`. Empty follow set → empty page.

## `POST /query/v1/users/:name/following-objects/threads`

- Threads with `deleted = false` and `threads.hashtags && <followed object ids>`.
- Viewer mutes (`user_account_mutes`) exclude authors when `X-Viewer` is set.
- Order: `(created_unix, author, permlink) DESC`. Cursor encoding matches the object/user threads feeds.
- Response: `UserBlogFeedResponse` (same item shape as [object threads feed](object-threads-feed.md)). `objects` lists the **followed** objects the thread is tagged with, in hashtag order, max 4, light projection (`name`, `image`, `parent`).

## `POST /query/v1/users/:name/following-objects/updates`

- All `object_updates` of the followed objects (every update type and locale; no approval filter).
- Order: `(created_at_unix, update_id) DESC`. Cursor = updates `recency` cursor; an `approval` cursor → empty page.
- Item = `ObjectUpdateFeedItem` from `GET /objects/:id/updates` (approval %, validity votes, `viewer_vote`, rank) plus `object`: light projection of the updated object, or `null` when it cannot be projected.
- Approval and votes are computed per object (ownership is object-scoped); governance is resolved once per page.

## Indexes

Migration `00072_followed_objects_feed_indexes`: GIN on `threads.hashtags`, B-tree `(object_id, created_at_unix DESC, update_id DESC)` on `object_updates`.

## MCP

`get_followed_objects_threads`, `get_followed_objects_updates` (see [mcp.md](mcp.md)).

## Verification

```bash
pnpm nx test query-api --testPathPatterns=followed
pnpm nx run query-api:typecheck
```
