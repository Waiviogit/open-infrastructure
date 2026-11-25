---
id: docs-apps-query-api-spec-search
title: Search endpoints
description: "Predictive search for the web shell header: ranked **objects** and **users**. Global tab counts are loaded separately for performance."
type: spec
status: active
scope: query-api
tags: [query-api, search]
updated_at: 2026-11-25
related:
  - docs/apps/query-api/spec/overview.md
  - docs/README.md
  - docs/apps/chain-indexer/spec/object-search-docs.md
  - docs/architecture/adr/search-read-model.md
---

# Search endpoints

Predictive search for the web shell header: ranked **objects** and **users**. Global tab counts are loaded separately for performance.

## HTTP

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/query/v1/search` | Optional `X-Viewer` for follower state on user rows and projection context |
| `GET` | `/query/v1/search/counts` | None required (counts do not depend on viewer or locale) |
| `POST` | `/query/v1/search/objects-by-ids` | Optional `X-Viewer`, `X-Governance-Object-Id`, locale headers (same as `GET /search`) |

### Query parameters — `GET /search`

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | yes | Search text, 1–100 chars after trim. |
| `limit` | integer | no | Max **object** hits (default `10`, max `20`). User hits are capped at **5** regardless. |
| `type` | `all` \| `objects` \| `users` | no | Default `all`. `objects` skips user search; `users` skips object FTS/projection. Web ref pickers use `users` / `objects` respectively. |

### Query parameters — `GET /search/counts`

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | yes | Same search text as `/search`. |

### Headers — `GET /search`

| Header | Description |
|--------|-------------|
| `X-Locale` / `Accept-Language` | Locale for object resolution (same as other read routes). |
| `X-Viewer` | Optional Hive account; used for `users[].is_following` and `ObjectProjectionService` authority context. It does **not** affect object ranking. |
| `X-Governance-Object-Id` | Optional; merged into governance snapshot for resolution/projection (same as `POST /objects/resolve`). |

## Response — `GET /search`

`SearchResponseDto`:

- **`objects`**: Array of `SearchObjectResult` — `object_id`, `object_type`, `name`, `image_url`, `parent_name` (subtitle in UI when present).
- **`users`**: Array of `SearchUserResult` — `name`, `profile_image`, `reputation` (`object_reputation`, vote/sort only), `wobjects_weight` (`accounts_current.wobjects_weight` — user expertise for display), `followers_count`, `is_following`.

No `type_counts` or `total_users` — use `/search/counts` for tab badges.

## Request — `POST /search/objects-by-ids`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `object_ids` | `string[]` | yes | 1–100 trimmed non-empty ids. Duplicates are deduped; response order follows first occurrence in the request. |

## Response — `POST /search/objects-by-ids`

`SearchObjectsByIdsResponseDto`:

- **`objects`**: Array of `SearchObjectResult` (same shape as `GET /search` object hits).

## Query plan — objects by ids (`POST /search/objects-by-ids`)

1. **`loadByObjectIds`** on `objects_core` PK (`status = 'active'`) — no FTS, no `meta_group_id` collapse.
2. Resolve + `ObjectProjectionService.batchProject` with update types `name`, `image`, `parent` (same as `/search` object cards).
3. Omit ids that are missing or inactive (no 404 on the batch).

## Response — `GET /search/counts`

`SearchCountsResponseDto`:

- **`type_counts`**: Map of `object_type` → number of matching active **groups** (one per `meta_group_id`).
- **`counts_capped`**: `true` when the text matched more than `SEARCH_COUNTS_MATCH_CAP` (100 000) documents; counting stopped there, so `type_counts` are lower bounds and web shows `N+`. Clients must not rely on exact totals for broad queries ([ADR rule R3](../../../architecture/adr/search-read-model.md#3-rules)).
- **`total_users`**: Total users matching the name prefix for `q` (exact, not capped at 5).

## Query plan — objects (`/search` and `/search/counts`)

Objects are searched in the read model [`object_search_docs`](../../chain-indexer/spec/object-search-docs.md): one document per active object holding only resolver winners (old, losing and rejected values never match). Only `repositories/search.repository.ts` and `repositories/object-search-filters.sql.ts` name that table.

**Tokenization** (`buildPrefixTsQuery` from `@opden-data-layer/object-search`, the same `normalizeSearchText` that builds the index): NFKC, lower case, format characters deleted, apostrophes inside words deleted (`women's` = `womens`), every other non-letter/digit/mark run is a space. Then, at most 10 tokens:

| Token | Becomes | Example |
|---|---|---|
| 2+ characters, or one Han / Kana / Hangul character | prefix `tok:*` | `greek tav` → `greek:* & tav:*`; `kvu-kis` → `kvu:* & kis:*` |
| one character, not last | exact `tok` | `iphone 5 pro` → `iphone:* & 5 & pro:*` |
| one character, last | dropped (still being typed) | `vitamin c` → `vitamin:*` |

No prefix term left (`c`, `c++`) → no object search (empty list, empty counts). Limits: no stemming, no accent folding (`café` ≠ `cafe`), no substring inside `object_id` (ids match by their words), CJK / Thai text without spaces is one word matched by prefix.

1. **`/search`:** documents with `search_vector @@ to_tsquery('simple', :tsQuery)` (GIN `idx_object_search_docs_vector`); flags on the found rows: exact `object_id = :q`, exact `name_norm = normalize(:q)`, `name_norm LIKE normalize(:q) || '%'`. Collapse with `DISTINCT ON (group_key)` keeping the best row by those flags, then `weight DESC NULLS LAST`, then `object_id`. Final order: exact id, exact name, name prefix, weight, `object_id` (`COLLATE "C"`). Ranking is viewer-independent. Then `projectByObjectIds` loads **active** cores only, resolves and projects — a document left for a just-deactivated object is dropped there.
2. **`/search/counts`:** the same text condition over at most `cap + 1` documents, `GROUP BY object_type` with `COUNT(DISTINCT group_key)`; `counts_capped` when more than the cap matched. For at most one indexer tick (3 s) after a status change a deactivated object can still be counted.

Object SQL and user SQL for `/search` run **in parallel** in `GetSearchEndpoint`. `/search/counts` runs `countObjectsByType` and `countUsers` in parallel in `GetSearchCountsEndpoint`.

## Query plan — users (`/search`)

1. `accounts_current` where `name >= lower(escape(:q))` and `name < upperBound(prefix)` (btree range on PK; Hive names are stored lowercase).
2. Order by **exact** `name = lower(trim(:q))` first, then `wobjects_weight DESC NULLS LAST`, `followers_count DESC`.
3. Cap at **5** rows.
4. If `X-Viewer` is set, `is_following` = existence of `user_subscriptions (follower, following)`.

## Query plan — user count (`/search/counts`)

1. Same btree prefix range as user search.
2. `COUNT(*)` on `accounts_current` (no limit).

## Errors

Validation failures on query params return **400** (Zod pipe). Infrastructure failures in repositories log and return empty slices / zero counts where documented.

## Discover

The Discover text and map filters use the same read model: [Discover endpoints](discover.md).
