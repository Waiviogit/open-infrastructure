---
id: docs-apps-query-api-spec-users-favorites-endpoint
title: User favorites endpoints
description: "Unified profile Favorites scope (favorites ∪ authored post links − deselect, per-type hide flags, type whitelist, no ownership) and the favorites type, list and map endpoints."
type: spec
status: active
scope: query-api
tags: [query-api, users, favorites]
updated_at: 2026-11-11
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/categories.md
  - docs/apps/query-api/spec/shop-feed-endpoints.md
  - docs/apps/web/spec/pages/user-profile/routes/favorites.md
---

# User favorites endpoints

**Back:** [query-api overview](overview.md) · **Affiliate:** [affiliate-links.md](affiliate-links.md) · **Categories:** [categories.md](categories.md) · **Lists and sections:** [shop-feed-endpoints.md](shop-feed-endpoints.md)

## Favorites scope

This section is the single definition of the profile Favorites scope. Every profile Favorites endpoint reads it: `categories`, `shop/filters`, `shop-objects`, `shop-sections`, `favorites/types`, `favorites` and `favorites/map`.

An object is in the scope of account `:name` for a set of requested types when all of these hold:

1. **Membership:** the account favorited it (`object_favorite`), **or** it is linked from a post the account authored (`post_objects.author = :name`).
2. **No ownership:** `object_ownership` is **not** part of the scope.
3. **Deselect:** ids in `user_shop_deselect` for the account are removed from the post-linked branch only. A favorited object stays in scope.
4. **Hide flags, per type:** post-linked objects of a type are dropped when the matching `user_metadata` flag is set. A missing `user_metadata` row means every flag is false.

   | Object type | Flag |
   |-------------|------|
   | `book`, `product` | `hide_linked_objects` |
   | `recipe` | `hide_recipe_objects` |
   | any other type | `hide_favorite_objects` |

5. **Type whitelist:** `objects_core.object_type ∈ USER_FAVORITES_OBJECT_TYPES` (`@opden-data-layer/core`): `FAVORITES_OBJECT_TYPES` ∪ `CATEGORY_OBJECT_TYPES`, minus `hashtag` and `governance`. Requested types are intersected with the whitelist.
6. **Active:** `objects_core.status = 'active'`.

Implementation:

- `UserFavoritesScopeResolver` (`apps/query-api/src/domain/favorites/user-favorites-scope.resolver.ts`) loads the flags and deselects once per request, intersects the requested types with the whitelist, and maps flags to post-linked types with `resolvePostLinkedObjectTypes`.
- `userFavoritesScopeCte` (`apps/query-api/src/repositories/user-favorites-scope.sql.ts`) is the one SQL definition (CTE `user_favorites_scope`). Lists are bound as array parameters.
- The chain-indexer precomputes per-type category rows from the same membership: [object-categories.md](../../chain-indexer/spec/object-categories.md).

## Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/query/v1/users/:name/favorites/types` | `{ types: string[], items: { object_type, objects_count, supports_categories, has_categories }[] }` |
| `GET` | `/query/v1/users/:name/favorites` | `{ items: ProjectedObject[], total, hasMore }` |
| `POST` | `/query/v1/users/:name/favorites/map` | `{ items: ProjectedObject[], hasMore }` (geo bbox filter) |

Unknown or blank accounts never 404: `types` returns `{ types: [], items: [] }`, the list returns an empty page, and a blank `:name` on the list returns a `null` body.

### `GET .../favorites/types`

Every whitelisted type present in the scope, sorted by count DESC, then type ASC.

- `types` keeps the legacy shape.
- `items` holds the same types in the same order:
  - `objects_count` is the live count in the scope;
  - `supports_categories` is `objectTypeSupportsCategories(type)` (the registry allows the `category` update);
  - `has_categories` is `supports_categories` and the category root of that type (the same `UserCategoryNavigationService` navigation as [categories.md](categories.md), on a one-type scope) lists at least one category. It is computed only for types with categorized objects (`object_categories.category_names` non-empty). Clients show category navigation only when it is true; otherwise the type is a flat list. While precomputed `acc:type` scope rows are still being rebuilt the root is empty, so the type stays a flat list instead of a chevron over an empty panel.

### Query (`GET .../favorites`)

| Param | Notes |
|-------|-------|
| `objectType` | Optional filter. A type outside the whitelist returns an empty page. |
| `skip` / `limit` | Offset pagination; default limit 20, max 50 |

Sort: `objects_core.weight DESC NULLS LAST`, `object_id ASC`.

### Body (`POST .../favorites/map`)

| Field | Notes |
|-------|-------|
| `box.topPoint` | `[lng, lat]` north-east corner |
| `box.bottomPoint` | `[lng, lat]` south-west corner |
| `objectTypes` | Optional; subset of `MAP_GEO_OBJECT_TYPES` (default: all map types) |
| `skip` / `limit` | Offset pagination; default limit 10, max 100 |

Scope types are `objectTypes ∩ MAP_GEO_OBJECT_TYPES ∩ USER_FAVORITES_OBJECT_TYPES`. Only objects whose latest `geo` update lies inside `box` are returned (PostGIS `ST_Intersects`).

Sort: `weight DESC NULLS LAST`, `object_id ASC`.

### Cards

All Favorites cards (list, map, `shop-objects`, `shop-sections`) resolve the same update types, `USER_FAVORITES_CARD_UPDATE_TYPES`. The map adds `geo`.

### Headers

Same as other user object lists: `Accept-Language` / `X-Locale`, optional `X-Viewer`, `X-Governance-Object-Id`.

## Web client

`apps/web` module `user-profile`: `fetchFavoritesTypes`, `fetchFavoritesObjects`, `fetchFavoritesMap`; cache tags `userFavoritesTypes`, `userFavorites`, `userFavoritesMap`.

## MCP

- `get_user_favorites_types`
- `get_user_favorites`
- `post_user_favorites_map`
