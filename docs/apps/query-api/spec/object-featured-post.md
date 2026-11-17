---
id: docs-apps-query-api-spec-object-featured-post
title: Object featured post
description: GET /query/v1/objects/:objectId/featured-post — the object's top pinned post in full, or null.
type: spec
status: active
scope: query-api
tags: [query-api, object-posts-feed]
updated_at: 2026-11-17
related:
  - docs/apps/query-api/spec/object-posts-feed.md
  - docs/apps/query-api/spec/single-post-endpoint.md
  - docs/apps/web/spec/pages/object/routes/featured-post.md
---

# Object featured post

`GET /query/v1/objects/:objectId/featured-post` — the post a recipe page shows on Details.

## Selection

The first pin of the Posts feed pinned block **without** viewer personalization (`selectObjectFeaturedPostRef` in `object-feed-pins.ts`, see [Pinned posts](object-posts-feed.md#pinned-posts)):

1. VALID `pin` updates only; a post with a VALID `remove` update is never featured.
2. Highest governance tier (admin, trusted, community, baseline), then community weight, then newest.
3. The viewer's own pins do not change it; `X-Viewer` only affects vote / reblog / favorite flags of the returned post.

## Response

`{ post: SinglePostView | null }` — `post` has the same shape as [`GET /query/v1/posts/:author/:permlink`](single-post-endpoint.md) (full `body`). `null` when nothing is pinned or the pinned post cannot be loaded.

Query: `currency`, `country` (same as the single-post endpoint). Headers: `Accept-Language` / `X-Locale`, `X-Governance-Object-Id`, `X-Viewer`.

| Case | Status |
|------|--------|
| Unknown / inactive object | 404 |
| No featured post | 200 `{ post: null }` |

## MCP

Tool: `get_object_featured_post` (`object_id`, `currency`, `country` + locale context).

## Verification

```bash
pnpm nx test query-api --testPathPatterns="object-feed-pins|get-object-featured-post"
```
