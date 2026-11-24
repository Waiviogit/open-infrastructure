---
id: docs-apps-query-api-spec-categories
title: Categories
description: "Category navigation over a scope (a user's Favorites type, or every object of a type for Discover): precomputed `object_categories_related` rows choose candidates; live counts and the client's display rules (≥ 3, ≤ 60%) decide what is shown."
type: spec
status: active
scope: query-api
tags: [query-api, categories, favorites, discover]
updated_at: 2026-11-24
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/users-favorites-endpoint.md
  - docs/apps/query-api/spec/shop-feed-endpoints.md
  - docs/apps/query-api/spec/discover-categories.md
  - docs/README.md
---

# Categories (`GET /users/:name/categories`)

**Back:** [Query API overview](overview.md) · **Scope:** [users-favorites-endpoint.md](users-favorites-endpoint.md#favorites-scope) · **Discover:** [discover-categories.md](discover-categories.md) · **Related:** [chain-indexer object-categories](../../chain-indexer/spec/object-categories.md)

## Purpose

Category navigation (sidebar tree) for one category object type. One service, [`CategoryNavigationService`](../../../../apps/query-api/src/domain/categories/category-navigation.service.ts), builds it over a **scope** (`CategoryCountScope`, [`category-scope.sql.ts`](../../../../apps/query-api/src/repositories/category-scope.sql.ts)):

| Scope | Objects | Unit counted | Precomputed rows | Filters |
|-------|---------|--------------|------------------|---------|
| `user` | the account's Favorites scope for the type | object | `('user', name:type)` | tags, rating |
| `type` | every active object of the type | group (`COALESCE(meta_group_id, object_id)`) | `('type', type)` | q, tags, box ([discover-categories.md](discover-categories.md)) |

- **Candidates:** precomputed `object_categories_related` rows choose the candidate names.
- **Counts:** every number shown is computed live over the scope after its filters, except the **unfiltered root of a type scope**: its counts, level total (`__total__` row) and `has_children` pair counts (`related_counts`) come from the precomputed type scope (as fresh as its last rebuild, at most ~10 min old), so it costs one indexed read.

## Endpoint

`GET /query/v1/users/{name}/categories`

| Param | Role |
|-------|------|
| `types` | **Required, exactly one** type from `CATEGORY_OBJECT_TYPES` (registry types whose `supported_updates` include `category`). Missing, several types, or a type without categories → **400**. There is no default. |
| `name` | Parent category for level ≥ 2 (omit = root). |
| `path` | Repeatable; ancestors before `name` when drilling down. |
| `excluded` | Repeatable; names to hide from the sibling list. |

Response: `{ items: { name, objects_count, has_children }[], uncategorized_count, show_other }`.

## Display rules (client)

Applied at **every level**, Favorites and Discover alike (`passesCategoryDisplayRules`, [`category-display-rules.ts`](../../../../libs/category-scopes/src/lib/navigation/category-display-rules.ts)):

1. A category with **fewer than 3** units (`CATEGORY_MIN_OBJECTS`) is not shown.
2. A category covering **more than 60%** (`CATEGORY_MAX_SHARE`) of the level's units is not shown.
3. Objects outside every shown category stay reachable from the level itself (`All` / the type).

The **level total** = scope units whose `category_names` contain the lineage (at the root: every scope unit, uncategorized included), after the scope's filters. These rules replaced the former level-2 thresholds (share in 1%–30%, more than 10 objects); the root had none before.

## Live counts

Let `lineage = [...path, name]` (empty at the root).

- **`objects_count`** = distinct scope units whose `object_categories.category_names` contain the whole `lineage` **and** the child name.
  - For a user scope this is the same set (and unit) that `shop-objects?categoryPath=[...lineage, child]` pages through.
  - `countCategoryLevel` runs two queries in parallel over the scope CTE: the level total and the per-name counts (the lineage filter is `category_names @> lineage`, names come from `unnest(category_names)`). One combined query would materialize the shared CTE and be about twice slower. At the root every name is a candidate, so the per-name query groups all names without matching a candidate list.
- **Hidden children:** a candidate whose count fails the display rules (including 0) is not returned, even when it co-occurs pairwise with every ancestor.
- **Order:** by live count, descending.
- **`has_children`** is true only when drilling into the child would list at least one item: some grandchild candidate whose live pair count with the child passes the display rules against the child's own count. One grouped pair-count query per request.
- **`uncategorized_count`** (user endpoint only):
  - at the **root**, the live count of scope objects with no `object_categories` row or empty `category_names` (equals the `shop-objects?uncategorizedOnly=true` list length);
  - **below the root, always `0`**. Uncategorized is a type-level node, not a child of a category.
- **No precomputed numbers:** the precomputed `objects_count` and the `__uncategorized__` sentinel row are never returned.

Implementation:

- [`GetUserCategoriesEndpoint`](../../../../apps/query-api/src/domain/categories/get-user-categories.endpoint.ts); `shop-sections` and `favorites/types` use the same service.
- Candidate selection and the root (pure, in [`@opden-data-layer/category-scopes`](../../../../libs/category-scopes/src/lib/navigation/index.ts), shared with the [`categories:rebuild`](../../../operations/category-scopes-rebuild.md) report): [`category-candidates.ts`](../../../../libs/category-scopes/src/lib/navigation/category-candidates.ts), [`category-level-view.ts`](../../../../libs/category-scopes/src/lib/navigation/category-level-view.ts) (`selectRootCategories`), [`level1-filter.ts`](../../../../libs/category-scopes/src/lib/navigation/level1-filter.ts), [`level2-filter.ts`](../../../../libs/category-scopes/src/lib/navigation/level2-filter.ts).

## Candidates: root (no `name`)

1. Every precomputed name is a candidate (not excluded).
2. Live counts; apply the display rules.
3. **Greedy dominance** among the names that pass, by live count: skip name **B** if **B** appears in the `related_names` of an already accepted name. Dominance runs after the rules, so a hidden catch-all category (over 60%) never suppresses the categories it co-occurs with.
4. Cap at **20** (`ROOT_DEPARTMENTS_LIMIT`). **`show_other`** is true when more than 20 names remain.

## Candidates: levels ≥ 2 (`name` set)

1. Candidates **D** ≠ `name`, not in `lineage`, not `excluded`, with every `lineage` name in `D.related_names` (pairwise co-occurrence; a candidate is not proof of a non-empty intersection).
2. Live counts; apply the display rules; sort by count.
3. Drop **near-duplicates** (greedy, stronger first): two categories whose common units are the majority of each set and whose sets each have fewer than 10 units outside the other (`NEAR_DUPLICATE_TOLERANCE`). The majority condition keeps small disjoint categories apart (with the 3-unit minimum they are always under the tolerance).
   - User scope: compared on the precomputed `group_keys`.
   - Type scope (no stored keys): live pair counts, `|A| − |A∩B| < 10` and `|B| − |A∩B| < 10`, for the top `NEAR_DUPLICATE_MAX_CANDIDATES` (60) by count; the rest is kept unchecked.

## Performance

A request runs at most these grouped queries over the scope CTE (`category_scope`); the unfiltered root of a type scope runs none:

1. level total and candidate counts (two parallel queries);
2. pair counts for `has_children`;
3. the uncategorized count (user root only);
4. near-duplicate pair counts (type scope, level ≥ 2).

The lineage filter uses `category_names @> …`, which the GIN index `idx_object_categories_category_names_gin` can serve. The user endpoint has no Redis cache; the Discover endpoint caches unfiltered levels ([discover-categories.md](discover-categories.md)).

Measured on a synthetic type (500k products, 5.5k category names): unfiltered root about 25 ms (precomputed); a live root (filters, before the first rebuild) about 1.5 s for counts plus 1.2 s for `has_children`, less when a filter narrows the type; a level below the root about 0.15 s.

## Global scope

Global object feeds by department name: [`category-objects.md`](category-objects.md) (`GET /query/v1/categories/objects`). User navigation stays on `GET /users/:name/categories`; Discover navigation is `GET /discover/categories`.
