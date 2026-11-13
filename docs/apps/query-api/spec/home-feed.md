---
id: docs-apps-query-api-spec-home-feed
title: Home feed
description: Hub FEED tab post timeline — global for guests, personalized when X-Viewer is set.
type: spec
status: active
scope: query-api
tags: [query-api, home-feed]
updated_at: 2026-11-13
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/web/spec/pages/home/page.md
---

# Home feed (read)

**Back:** [query-api overview](overview.md)

## HTTP

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/query/v1/posts/feed` | Paginated newest-first root posts for the hub FEED tab. |

## Modes

| Viewer | Feed scope |
|--------|------------|
| Guest (no `X-Viewer`) | All root posts (`depth = 0` or null) in `posts`, ordered by `created_unix` DESC. |
| Logged-in (`X-Viewer`) | Posts matching **any** of: author in `user_subscriptions.following` for viewer; linked **active** object in `user_object_follows`, `object_favorite` or `object_ownership` for viewer. |

Muted authors (`user_account_mutes`) are excluded for logged-in viewers. Reblogs are not included in v1.

**Viewer's own posts:** included only when the viewer follows themselves, a followed object is linked on the post, or the viewer has admin/ownership authority on a linked object. Own root posts are **not** implicitly included.

## Performance

| Mode | Query shape | Index |
|------|-------------|-------|
| Guest | Root posts ordered by `created_unix DESC` | `idx_posts_root_created_unix` (partial, `depth = 0 OR depth IS NULL`) |
| Logged-in | `UNION` of two branches, each limited before the merge: a `LATERAL` page per followed author, and newest root posts with an `EXISTS` on the viewer's object set | `idx_posts_author_created_unix`; `idx_posts_root_created_unix` + `post_objects` PK |

The same queries serve the hub feed "New" and "My feed" filters ([hub feed](hub-feed.md)).

## Request body: `HomeFeedBody`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number (int, 1–50) | `20` | Page size. |
| `cursor` | string \| omitted | — | Opaque cursor from prior response. |
| `currency` | enum | `USD` | Reward display currency. |

## Response

Same shape as [User blog feed](user-blog-feed-endpoint.md): `UserBlogFeedResponse` with `items`, `cursor`, `hasMore`. Hydration uses `buildFeedStoryItemsFromPostPage`.

## Implementation

- Endpoint: `GetHomeFeedEndpoint`
- Repository: `HubPostsFeedRepository.findNew` (guest) / `findMy` (viewer)
- Controller: `PostsController.getHomeFeedRoute`
