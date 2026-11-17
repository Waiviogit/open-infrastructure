---
id: web-pages-object-routes-featured-post
title: Object page — featured post on Details
description: "Recipe Details shows the object's featured post (top pin, else newest post) in full in the middle column, in place of the description."
type: spec
status: active
scope: web
tags: [web, page, object, recipe]
updated_at: 2026-11-17
related:
  - docs/apps/web/spec/pages/object/page-shell.md
  - docs/apps/web/spec/pages/object/routes/recipe-left-rail.md
  - docs/apps/web/spec/object-post-pin-remove.md
  - docs/apps/query-api/spec/object-featured-post.md
---

# Object page — featured post on Details

**Back:** [page shell](../page-shell.md) · **Related:** [Pin / Remove](../../../object-post-pin-remove.md), [query-api featured post](../../../../../query-api/spec/object-featured-post.md)

## Behavior

A recipe goes together with its featured post — the first post of its Posts feed as an anonymous viewer sees it:

1. the top pinned post (`pin` update, ranked by governance, then votes, then newest);
2. else the newest post of the Posts feed (same scope, removed posts excluded);
3. else nothing — the description stays.

On the **Details** tab the middle column shows that post in full (`BlogPostScreen`: title, author, video, body, votes, comments) instead of `ObjectDescriptionBody`.

| Case | Middle column |
|------|---------------|
| Recipe with a pinned post | Top pinned post |
| Recipe without pins but with posts | Newest post |
| Recipe without posts, or the post is gone | Description (unchanged) |
| Other object types | Description (unchanged) |
| Nested menu / page content on Details | Unchanged (featured post only replaces the description) |

The featured post is the same for every viewer; the viewer's own pins only reorder the Posts feed. The recipe left rail keeps the description with **Show more**.

## Data

- `page.tsx` loads `getObjectFeaturedPostQuery(objectId, locale, viewer)` for every tab of a recipe (in parallel with the tab data), so switching to Details does not flash the description first.
- Query → `GET /query/v1/objects/:id/featured-post`, cached with tag `objectFeaturedPost(objectId)`; `revalidateObjectAfterBroadcast` clears it, so Pin / Unpin / Remove on the Posts tab update Details. A newly published post shows up within the query cache lifetime (60 s), like the Posts feed.
- Types that opt in: `FEATURED_POST_OBJECT_TYPES` in `apps/web/src/modules/object/domain/object-featured-post.ts` (today `recipe`).

## Code

| Area | Location |
|------|----------|
| Type rule | `apps/web/src/modules/object/domain/object-featured-post.ts` |
| Query / client | `apps/web/src/modules/feed/application/queries/get-object-featured-post.query.ts`, `apps/web/src/modules/feed/infrastructure/clients/object-featured-post.client.ts` |
| Details render | `apps/web/src/modules/object/presentation/components/object-primary-content.tsx` |

## Legacy

Same as legacy social sites (`SocialProduct` → `RecipePost`, "Top Recipe"): the first post of the object feed on recipes — the pinned one, else the newest. Legacy showed nothing without posts; here the description stays.
