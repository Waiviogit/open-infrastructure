---
id: docs-apps-query-api-spec-category-other
title: The Other category
description: "The virtual Other category of a category level: its objects in none of the child categories the tree shows. Count (`other_count`), listing (`other`), the last-page block, Discover and Favorites."
type: spec
status: active
scope: query-api
tags: [query-api, categories, discover, favorites]
updated_at: 2026-11-24
related:
  - docs/apps/query-api/spec/categories.md
  - docs/apps/query-api/spec/discover-categories.md
  - docs/apps/query-api/spec/shop-feed-endpoints.md
---

# The Other category

The display rules ([categories.md](categories.md#display-rules-client)) hide categories (fewer than 3 units, over 60% of the level, near-duplicates, past the root cap of 20). Without a catch-all, the objects of a level that are in none of the shown children would appear nowhere. Example: `Women › Outerwear` has 6 objects, but only `Active & Performance` (3) is shown, so the other 3 would be lost.

**Other of a level** (lineage `L`, the level's filters) = scope units under `L` in **none of the child categories the tree shows at `L`** (the `items` of the category navigation of `L`).

- Units: groups (`COALESCE(meta_group_id, object_id)`) on Discover, objects on Favorites. On Discover a group counts as covered when any of its active objects carries `L` and a shown name.
- At the **root** it also contains every uncategorized unit. On Favorites the root Other replaces the former Uncategorized node. The Discover root has no Other: its root is the `All` feed.
- Other exists only next to shown categories. A level with no shown child is a leaf, whose flat list already has every object.
- The 3-unit and 60% rules do not apply to Other: it is shown with any count ≥ 1.

## Count: `other_count`

`CategoryNavigationService.build({ …, includeOther: true })`:

```
other_count = level total − countUnitsInAnyCategory(scope, L, shown names)
```

- `countUnitsInAnyCategory` = distinct scope units under `L` with `category_names && shown names`.
- It is one extra query, run in parallel with `has_children`, and only when the level shows a category; otherwise `other_count` is 0.

| Route | `other_count` |
|-------|---------------|
| `GET /users/:name/categories` | Every level, the root included (uncategorized objects counted). The deprecated `uncategorized_count` stays in the response. |
| `GET /discover/categories` | Below the root only (0 at the type root). The cached unfiltered level carries it; cache key version `v2`. |

## Listing: `other=true`

`CategoryNavigationService.visibleCategoryNames` resolves the shown names of `L`, with the same filters as the tree the page shows. The listing then keeps the units under `L` in none of them.

| Route | Param | Shown names from |
|-------|-------|------------------|
| `GET /discover/objects` (feed, map markers) | `other` + `category_path` | Type tree of `L` with `q` / `tags` / `box`. Group-level exclusion, before the group collapse. |
| `GET /discover/tag-categories` | `other` + `category_path` | Same as `objects`; facets skip the cache. |
| `GET /users/:name/shop-objects` | `other` + `categoryPath` (one category type) | User tree of `L` without tags / rating (the rail). It wins over `uncategorizedOnly`. |
| `GET /users/:name/shop/filters` | `other` + `categoryPath` | Same as `shop-objects`. |

A type without a category tree (Discover) or a scope that is not exactly one category type (Favorites) returns an empty list.

SQL:
- Discover: `buildDiscoverExcludedCategoriesFilter` in [`discover-object-filters.sql.ts`](../../../../apps/query-api/src/repositories/discover-object-filters.sql.ts). The group siblings are joined through `objects_core.meta_group_id`, which is served by the partial index `idx_objects_core_meta_group_id_active`.
- Favorites: `categoryMembershipFilter(path, false, excludedNames)` in [`user-favorites-scope.sql.ts`](../../../../apps/query-api/src/repositories/user-favorites-scope.sql.ts). The filter is `NOT (COALESCE(category_names, '{}') && names)`.

## Block: `other` on the last sections page

`GET /discover/sections` and `GET /users/:name/shop-sections` add `other: { items, totalObjects } | null` to their response.
- It is non-null only on the last page (`hasMore = false`), when `other_count > 0`.
- `items` are the top 3 by rank (Discover) or by weight (Favorites), projected like the section previews.
- `totalObjects` = `other_count`.

## Clients

- **Web:** Discover `?cat=…&other=1` ([page.md](../../web/spec/pages/discover/page.md#categories)) and Favorites `…/:type/…lineage?other=1` ([favorites.md](../../web/spec/pages/user-profile/routes/favorites.md)).
- **MCP:** `discover_objects`, `discover_tag_categories`, `get_user_shop_objects` and `get_user_shop_filters` take `other`. `discover_categories` and `get_user_categories` return `other_count`. The sections tools return `other`.

## Verification

- `pnpm nx test query-api --testPathPatterns="(category-navigation|discover|shop)"`
- `pnpm test:db:up`, then `POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test query-api --testPathPatterns="(object-categories.repository|discover.repository).db"`.
