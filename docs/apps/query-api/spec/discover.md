---
id: docs-apps-query-api-spec-discover
title: Discover endpoints
description: "`GET /discover/objects`, `/discover/users`, `/discover/tag-categories`: Discover listings and tag facets with text, tag, map-box and category filters; text and box read object_search_docs, tags and categories their own tables."
type: spec
status: active
scope: query-api
tags: [query-api, discover]
updated_at: 2026-11-25
related:
  - docs/apps/query-api/spec/search.md
  - docs/apps/query-api/spec/discover-categories.md
  - docs/apps/chain-indexer/spec/object-search-docs.md
---

# Discover endpoints

Used by the web `/discover` page (BFF proxies under `/api/discover/*`).

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/query/v1/discover/objects` | Optional `X-Viewer` |
| `GET` | `/query/v1/discover/users` | Optional `X-Viewer` |
| `GET` | `/query/v1/discover/tag-categories` | None |

### Query parameters — `GET /discover/objects`

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `object_type` | string | no | Registry object type filter |
| `q` | string | no | Optional text filter (max 100 chars): same tokenization as `/search`, matched against `object_search_docs`; a text without a prefix term returns nothing |
| `tags` | string[] | no | Tag filters (`category:value`), AND semantics |
| `sort` | `rank` \| `newest` \| `oldest` | no | Default `rank` |
| `box` | string | no | Map bounding box: `swLng,swLat,neLng,neLat` (WGS84). The object's point in `object_search_docs` (the resolver's `geo` winner) must lie in `ST_MakeEnvelope(..., 4326)` (GiST `idx_object_search_docs_geo`). |
| `cursor` | string | no | Opaque pagination cursor |
| `limit` | integer | no | Default 20, max 50 |

Results collapse to **one row per `meta_group_id`** (`COALESCE(meta_group_id, object_id)`). The representative is the SKU that would appear first under the active sort among matching active objects: `rank` keeps highest `weight`, `newest`/`oldest` keep that group's newest or oldest `created_at`. Keyset cursor and `limit` apply after collapse.

### Query parameters — `GET /discover/tag-categories`

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `object_type` | string | yes | Object type for facet listing |
| `q` | string | no | Optional text filter (same rules as objects) |
| `tags` | string[] | no | Selected tags (AND) to narrow facets |
| `box` | string | no | Same bounding box as objects; facet counts respect the geographic predicate |

When `q`, any `tags`, or `box` is present, facet results are computed live and **not** read from or written to the per-`object_type` Redis cache key.

Facet `count` is the number of **distinct active groups** (`COUNT(DISTINCT COALESCE(objects_core.meta_group_id, object_id))`), not SKU rows. Inactive objects are excluded.

## Filter sources

All filters narrow a set driven from `objects_core` with `status = 'active'` (`repositories/discover-object-filters.sql.ts`):

| Filter | Source |
|---|---|
| `q`, `box` | `object_search_docs` (`buildObjectSearchDocsFilter` in `repositories/object-search-filters.sql.ts`): `object_id IN (SELECT … WHERE [object_type = …] [AND search_vector @@ …] [AND geo && envelope])`; the type condition is omitted for untyped Discover |
| `tags` | `object_tag_category_items` |
| `category_path`, Other | `object_categories` ([Discover categories](discover-categories.md)) |

A document left behind for a deactivated object cannot surface: the active-status condition is on `objects_core`. The Favorites map (`findMapObjectIdsByScope`) uses the same box filter, so Favorites and Discover share one definition of an object's point.
