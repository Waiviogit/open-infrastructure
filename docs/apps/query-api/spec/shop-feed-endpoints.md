---
id: docs-apps-query-api-spec-shop-feed-endpoints
title: Favorites object lists, sections and filters
description: "`shop-objects` (flat keyset list), `shop-sections` (live-counted category sections) and `shop/filters` (tag and rating facets) over the unified profile Favorites scope."
type: spec
status: active
scope: query-api
tags: [query-api, shop-feed-endpoints, favorites]
updated_at: 2026-11-11
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/users-favorites-endpoint.md
  - docs/apps/query-api/spec/categories.md
---

# Favorites object lists, sections and filters

**Back:** [query-api overview](overview.md) · **Scope:** [users-favorites-endpoint.md](users-favorites-endpoint.md#favorites-scope) · **Navigation:** [categories.md](categories.md)

The route names keep the historical `shop` prefix. All three read the unified Favorites scope defined in [users-favorites-endpoint.md](users-favorites-endpoint.md#favorites-scope). Ownership is not part of it.

## `types` (all three routes)

- `types` is repeatable and required. There is no `book`/`product` default.
- Every entry must be in `USER_FAVORITES_OBJECT_TYPES`; otherwise the route returns 400 (Zod).

## `GET /query/v1/users/:name/shop-objects`

A flat `ProjectedObject[]` of the scope.

| Param | Notes |
|-------|-------|
| `categoryPath` | Repeatable. Objects whose `category_names` contain every segment (`@>`). |
| `uncategorizedOnly` | `true` → only objects with no `object_categories` row or empty `category_names`. |
| `tags` | Repeatable `category:value`, AND. |
| `rating` | `6` \| `8` \| `10` legacy threshold (see below). |
| `limit` | Default 20, max 50. |
| `cursor` | Opaque keyset cursor from the previous page. A malformed cursor (including a legacy bare `object_id`) returns 400. |

- **Order:** `weight DESC NULLS LAST, object_id ASC`.
- **Cursor:** base64url JSON `{ weight, object_id }` of the last row, from `domain/pagination/weight-object-cursor.ts`. The same helper serves `GET /categories/objects`.
- **Response:** `{ items, cursor, hasMore }`. `cursor` is `null` on the last page.

## `GET /query/v1/users/:name/shop-sections`

Grouped previews for an intermediate category node.

| Param | Notes |
|-------|-------|
| `name`, `path` | Selected lineage: `[...path, name]`; omit `name` at the root. |
| `tags`, `rating` | Same filters as `shop-objects`. |
| `sectionLimit` | Sections per page (default 3, max 10). |
| `cursor` | Last category name of the previous page. Unknown name → empty response. |

- **Type:** sections need exactly one category type (`CATEGORY_OBJECT_TYPES`). Other `types` (a type without categories, or several types) return `{ sections: [], cursor: null, hasMore: false }`.
- **Sections:** the children of the lineage, from the same candidates and order as [`GET …/categories`](categories.md). The active `tags`/`rating` filters apply.
- **`totalObjects`:** always the live `COUNT(DISTINCT object_id)` over the scope ∩ `[...lineage, section]`, with the same filters, with or without filters active. It equals the length of the fully paginated `shop-objects` list for `categoryPath = [...lineage, section]` with the same filters.
- **Empty sections:** a section whose count is 0 is omitted. A section never opens an empty leaf.
- **Previews:** up to 3 objects per section (`SHOP_SECTION_OBJECTS_PER_CATEGORY`), ordered `weight DESC NULLS LAST, object_id ASC`.
- **Response:** `{ sections: { categoryName, items, totalObjects }[], cursor, hasMore }`.

## `GET /query/v1/users/:name/shop/filters`

- Tag category facets over the scope under `categoryPath` (or `uncategorizedOnly`).
- Optional `tags` (AND) and `rating` narrow the facet counts.
- Rating thresholds are static: `[10, 8, 6]`.

## Shared rules

**Rating filter SQL:**

- `rating=6|8|10` maps to ODL `rank_score >= threshold × 1000` on any `aggregateRating` update.
- It uses the persisted `object_updates.rank_score`, or the mean `rank_votes.rank` when the score is null (the same fallback as object projection).
- Legacy Mongo `average_rating_weight` (0–10) is migrated to `rank_score` during import.

**Counting unit:** every number these routes return is `COUNT(DISTINCT object_id)` over the same scope CTE that the lists page through. No route returns precomputed `object_categories_related.objects_count`, which counts product groups.

**Projection:**

- `ObjectViewService` with `USER_FAVORITES_CARD_UPDATE_TYPES`, then `ObjectProjectionService.batchProject`.
- Optional `country` + GeoIP build [affiliate links](affiliate-links.md).

**Client:** the profile Favorites tab (`apps/web`) loads these routes for the active type: sections for non-leaf browsing without filters, `shop-objects` for leaves, Uncategorized and any filtered view, and `shop/filters` for the right column.

**See also:** [categories.md](categories.md), [object-categories.md](../../chain-indexer/spec/object-categories.md).
