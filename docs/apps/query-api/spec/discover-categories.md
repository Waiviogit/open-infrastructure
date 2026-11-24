---
id: docs-apps-query-api-spec-discover-categories
title: Discover categories
description: "`GET /discover/categories`: one level of an object type's category tree over every active object of the type, counted in groups and narrowed by the Discover filters; plus the `category_path` filter on Discover objects and tag facets."
type: spec
status: active
scope: query-api
tags: [query-api, discover, categories]
updated_at: 2026-11-24
related:
  - docs/apps/query-api/spec/categories.md
  - docs/apps/chain-indexer/spec/object-categories.md
  - docs/apps/web/spec/pages/discover/page.md
---

# Discover categories

**Back:** [Categories](categories.md) · **Indexer:** [object-categories](../../chain-indexer/spec/object-categories.md) · **Web:** [Discover page](../../web/spec/pages/discover/page.md)

## Endpoint

`GET /query/v1/discover/categories` (MCP tool `discover_categories`)

| Param | Role |
|-------|------|
| `object_type` | **Required**, one of `CATEGORY_OBJECT_TYPES`; otherwise **400**. |
| `category_path` | Repeatable, root first: the selected lineage. The response lists its children; omit for the root. |
| `q` | Optional text filter (same matching as `discover/objects`). |
| `tags` | Repeatable `category:value`, AND. |
| `box` | Map bounding box `swLng,swLat,neLng,neLat`. |

Response: `{ items: { name, objects_count, has_children }[], show_other }`. No `uncategorized_count`: Discover has no Uncategorized node, objects without a category are listed at the type root (`All`).

## Behaviour

- Built by `CategoryNavigationService` over the **type scope** ([categories.md](categories.md)): every active object of the type after `q` / `tags` / `box`; candidates from `object_categories_related` rows `('type', object_type)`.
- **Counts are groups** (`COALESCE(meta_group_id, object_id)`), the unit of the Discover feed cards and tag facets.
- Display rules (≥ 3 groups, ≤ 60% of the level), ordering, `has_children`, the root cap of 20 and `show_other` are those of [categories.md](categories.md).
- **Unfiltered root:** served from the precomputed type scope (counts, `__total__`, `related_counts` for `has_children`), no query over the type.
- **Cache:** a level without `q`, `tags` and `box` is cached in Redis, key `query-api:cache:discover-categories:{type}:{sha256(lineage)}`, TTL `DISCOVER_CATEGORIES_CACHE_TTL_SEC` (600 s, the type scope rebuild interval). A filtered level is always computed.
- **Freshness:** candidates (and the unfiltered root's numbers) come from the type scope, rebuilt at most every 10 minutes per type ([object-categories](../../chain-indexer/spec/object-categories.md#throttling-type-scopes)); other counts are live (within the cache TTL).

Implementation: [`GetDiscoverCategoriesEndpoint`](../../../../apps/query-api/src/domain/discover/get-discover-categories.endpoint.ts).

## `category_path` on Discover objects and facets

`GET /discover/objects` and `GET /discover/tag-categories` accept the same repeated `category_path`: only objects whose `category_names` contain every name (`EXISTS … @>`), before the group collapse. Tag facets with a category path skip the tag-facet cache. Shared filter fragments: [`discover-object-filters.sql.ts`](../../../../apps/query-api/src/repositories/discover-object-filters.sql.ts).

## Verification

- `pnpm nx test query-api --testPathPatterns="(domain/discover|domain/categories)"`
- `pnpm test:db:up`, then `POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test query-api --testPathPatterns="(object-categories.repository|discover.repository)"`
