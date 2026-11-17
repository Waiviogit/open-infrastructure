---
id: docs-apps-query-api-spec-object-featured-post
title: Object featured post
description: GET /query/v1/objects/:objectId/featured-post — the object's top pinned post, else its newest post, in full; or null.
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

The first post of the [Posts feed](object-posts-feed.md) for an **anonymous** viewer (`GetObjectPostsFeedEndpoint.findFirstPost`, same scope builder as the feed):

1. The top pin of the pinned block ([Pinned posts](object-posts-feed.md#pinned-posts)): VALID `pin` only, a post with a VALID `remove` is never featured; governance tier (admin, trusted, community, baseline), then community weight, then newest. `source: "pinned"`.
2. Else the newest post of the feed scope (linked objects, group siblings, relisted sources, link / mention matches; removed posts excluded). `source: "latest"`.
3. Else no post.

The viewer's own pins and mutes do not change it; `X-Viewer` only affects vote / reblog / favorite flags of the returned post.

## Response

`{ post: SinglePostView | null, source: "pinned" | "latest" | null }` — `post` has the same shape as [`GET /query/v1/posts/:author/:permlink`](single-post-endpoint.md) (full `body`). `post` and `source` are null when the object has no posts or the chosen post cannot be loaded.

Query: `currency`, `country` (same as the single-post endpoint). Headers: `Accept-Language` / `X-Locale`, `X-Governance-Object-Id`, `X-Viewer`.

| Case | Status |
|------|--------|
| Unknown / inactive object | 404 |
| No posts | 200 `{ post: null, source: null }` |

## MCP

Tool: `get_object_featured_post` (`object_id`, `currency`, `country` + locale context).

## Verification

```bash
pnpm nx test query-api --testPathPatterns="get-object-posts-feed|get-object-featured-post"
```
