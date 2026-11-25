---
id: docs-architecture-adr-search-read-model
title: 'ADR: Object search read model (object_search_docs)'
description: Object text search, the Discover text and map filters and the Favorites map read one precomputed document per active object (object_search_docs) maintained by chain-indexer; rules that keep a later move to a search engine cheap; measured limits.
type: adr
status: active
scope: platform
tags: [platform, adr, search]
updated_at: 2026-11-25
related:
  - docs/apps/chain-indexer/spec/object-search-docs.md
  - docs/apps/query-api/spec/search.md
  - docs/operations/object-search-docs-rebuild.md
  - docs/architecture/adr/postgres-over-mongo.md
---

# ADR: Object search read model (`object_search_docs`)

**Status:** Accepted  
**Date:** 2026-11-25  
**Context:** [PostgreSQL over MongoDB](postgres-over-mongo.md), [object search documents](../../apps/chain-indexer/spec/object-search-docs.md), [search API](../../apps/query-api/spec/search.md).

## 1. Context

Object search (header, editor `#`, Discover text filter) ran over `object_updates`: every update row of an object was a candidate, including losing and rejected values, and the SQL unioned up to eight lookups (FTS, name prefix, id prefix and substring, identifier and locality prefix). On the local copy (833k objects) the header took 35–200 ms and Discover with text 260–790 ms; old or rejected names still matched; each new searchable field needed a new lookup and index.

## 2. Decision

One row per **active** object in `object_search_docs`, maintained by chain-indexer through `object_search_docs_sync_queue` (the pattern of `object_categories`). The row holds the winning texts as one `tsvector` (`simple` configuration, weights A names, B titles, C identifiers / locality / id words, D descriptions), `name_norm`, the winning map point, `group_key`, `weight` and `created_at`. Header search, type counts, the Discover text and box filters and the Favorites map read it. Tag and category filters stay on `object_tag_category_items` / `object_categories`, so a list and its facets keep one source.

Winners are resolved with `ObjectViewService` and the configured platform governance — the same resolver every read uses — in [`@opden-data-layer/object-search`](../../../libs/object-search/src/index.ts). The worker and `pnpm search-docs:rebuild` call one rebuild service, so both write identical rows.

Measured on the 833k-object copy: header 0.15–9 ms on typical queries, Discover with text 1–14 ms.

## 3. Rules

| # | Rule | Enforcement |
|---|---|---|
| R1 | The worker does not know where a document is written | Engine-neutral `ObjectSearchDocument` + `ObjectSearchSink`; Postgres is the first sink, injected as an array (`OBJECT_SEARCH_SINKS`) |
| R2 | Search SQL does not spread | Only `search.repository.ts` and `object-search-filters.sql.ts` in query-api name `object_search_docs` or build a tsquery; a spec fails otherwise |
| R3 | The API allows capped counts | `counts_capped` in `GET /search/counts`; web renders `N+` |
| R4 | No feature depends on exhaustive exact results | No totals, page numbers or deep sorted pagination under a text filter |

## 4. Accepted behaviour changes

- No English stemming: words are indexed as typed, so `running` no longer finds `run`; prefixes still match (`restaura` finds `restaurant`).
- No substring match inside `object_id`; ids are found by their words (`kvu-kis`).
- Object search needs a token of at least 2 characters (or one CJK character); users search is unchanged.
- Old, losing and rejected values no longer match. The map point is the resolver's `geo` winner, not the newest `geo` update.
- After a platform governance change, documents are rebuilt by the operator (`pnpm search-docs:rebuild --all`); the indexer only logs a warning.

## 5. Limits

The GIN index returns every match; the time of a query grows with the number of matches, not the page size.

| Scale | Approach |
|---|---|
| Up to about 3–5M objects | This table as designed: exact ordering per query, counts capped at 100k matches |
| Tens of millions | Same table plus weight tiers (search the high-weight tier first) and lower count caps |
| Beyond | Text search moves to an engine as a second sink; Postgres stays the source of truth. The document then also needs tags and categories, since the engine has to apply those filters itself |

Organic growth (about 75–135k objects a year) is far from the first limit. The signal to act is response time above 300 ms on broad queries.

## 6. Consequences

- One more queue and worker in chain-indexer; every writer of document inputs (updates, validity votes, status, ownership, `meta_group_id`, `weight`) enqueues the object.
- Indexes on `object_updates` used only by the old search are dropped in a separate migration after production runs on the new search for a few days (about 740 MB on the local copy).
