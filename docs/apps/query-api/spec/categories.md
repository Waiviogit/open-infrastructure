---
id: docs-apps-query-api-spec-categories
title: Categories
description: "Category navigation for one Favorites type of a Hive account: precomputed `object_categories_related` rows (`scope_key = account:type`) choose candidates and order; every count is a live object count over the Favorites scope ∩ full lineage."
type: spec
status: active
scope: query-api
tags: [query-api, categories, favorites]
updated_at: 2026-11-11
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/users-favorites-endpoint.md
  - docs/apps/query-api/spec/shop-feed-endpoints.md
  - docs/README.md
---

# Categories (`GET /users/:name/categories`)

**Back:** [Query API overview](overview.md) · **Scope:** [users-favorites-endpoint.md](users-favorites-endpoint.md#favorites-scope) · **Related:** [chain-indexer object-categories](../../chain-indexer/spec/object-categories.md)

## Purpose

Category navigation (sidebar tree) for one category object type in an account's Favorites scope.

- **Candidates:** precomputed `object_categories_related` rows (`scope_type = 'user'`, `scope_key = buildUserCategoryScopeKey(name, type)` = `name:type`) choose the candidate names and their order.
- **Counts:** every number shown is computed live.

## Endpoint

`GET /query/v1/users/{name}/categories`

| Param | Role |
|-------|------|
| `types` | **Required, exactly one** type from `CATEGORY_OBJECT_TYPES` (registry types whose `supported_updates` include `category`). Missing, several types, or a type without categories → **400**. There is no default. |
| `name` | Parent category for level ≥ 2 (omit = root). |
| `path` | Repeatable; ancestors before `name` when drilling down. |
| `excluded` | Repeatable; names to hide from the sibling list. |

Response: `{ items: { name, objects_count, has_children }[], uncategorized_count, show_other }`.

## Live counts

Let `lineage = [...path, name]` (empty at the root), and let the scope be the Favorites scope for `[type]`.

- **`objects_count`** = `COUNT(DISTINCT object_id)` of scope objects whose `object_categories.category_names` contain the whole `lineage` **and** the child name.
  - This is the same set (and unit) that `shop-objects?categoryPath=[...lineage, child]` pages through.
  - It is one grouped query per request: the lineage filter is `category_names @> lineage`, then names are counted from `unnest(category_names)`.
- **Empty children are dropped:** a candidate whose intersection is empty is not returned. This holds even when it co-occurs pairwise with every ancestor (A∩X ≠ ∅ and B∩X ≠ ∅, but A∩B∩X = ∅).
- **`has_children`** is true only when drilling into the child would list at least one item. Some grandchild candidate (same heuristics as the drill-down) must have a non-empty live intersection with `[...lineage, child, grandchild]`. This is one grouped pair-count query per request.
- **`uncategorized_count`:**
  - at the **root**, the live count of scope objects with no `object_categories` row or empty `category_names` (equals the `shop-objects?uncategorizedOnly=true` list length);
  - **below the root, always `0`**. Uncategorized is a type-level node, not a child of a category. This closes the earlier spec/code divergence, where the spec said drill-down kept the precomputed sentinel value.
- **No precomputed numbers:** the precomputed `objects_count` (product-group units, possibly stale) and the `__uncategorized__` sentinel row are never returned.

Implementation:

- [`GetUserCategoriesEndpoint`](../../../../apps/query-api/src/domain/categories/get-user-categories.endpoint.ts) and [`UserCategoryNavigationService`](../../../../apps/query-api/src/domain/categories/user-category-navigation.service.ts). `shop-sections` uses the same service.
- Candidate selection: [`category-candidates.ts`](../../../../apps/query-api/src/domain/categories/category-candidates.ts), [`level1-filter.ts`](../../../../apps/query-api/src/domain/categories/level1-filter.ts), [`level2-filter.ts`](../../../../apps/query-api/src/domain/categories/level2-filter.ts).

## Candidates: root (no `name`)

1. Sort precomputed rows by their `objects_count` descending.
2. **Greedy dominance:** skip name **B** if **B** appears in the `related_names` of an already accepted row.
3. Drop names whose live count is 0.
4. Cap at **20** (`ROOT_DEPARTMENTS_LIMIT`). **`show_other`** is true when more than 20 non-empty names remain.

## Candidates: levels ≥ 2 (`name` set)

1. Candidates **D** ≠ `name`, not in `lineage`, not `excluded`, with every `lineage` name in `D.related_names` (pairwise co-occurrence; a candidate is not proof of a non-empty intersection).
2. **`total`** = sum of precomputed `objects_count` among candidates. Keep **D** where `objects_count / total` is in **(1%, 30%)** and `objects_count > 10`.
3. Sort by precomputed `objects_count` desc. Drop **near-duplicates** when both sides miss fewer than 10 group keys vs their intersection (`GROUP_KEY_OVERLAP_TOLERANCE`, on `group_keys`).
4. Drop names whose live count is 0.

## Performance

A request runs at most three queries over the scope CTE:

1. counts for the candidates;
2. pair counts for `has_children`;
3. the uncategorized count (root only).

Each is grouped, not one query per candidate. The lineage filter uses `category_names @> …`, which the GIN index `idx_object_categories_category_names_gin` can serve. No Redis cache is used.

## Global scope

Global object feeds by department name: [`category-objects.md`](category-objects.md) (`GET /query/v1/categories/objects`). User navigation stays on `GET /users/:name/categories`.
