---
id: docs-apps-chain-indexer-spec-object-search-docs
title: Object search documents
description: One search document per active object in object_search_docs, built from resolver winners with platform governance and kept current by a queue and worker in chain-indexer; contents, triggers, queue priority, status handling, invariants and known gaps.
type: spec
status: active
scope: chain-indexer
tags: [chain-indexer, search]
updated_at: 2026-11-25
related:
  - docs/architecture/adr/search-read-model.md
  - docs/apps/query-api/spec/search.md
  - docs/operations/object-search-docs-rebuild.md
  - docs/apps/chain-indexer/spec/object-status.md
  - docs/apps/chain-indexer/spec/object-categories.md
---

# Object search documents (`object_search_docs`)

Read model behind object search: one row per **active** object. Decision and limits: [ADR](../../../architecture/adr/search-read-model.md). Readers: [search API](../../query-api/spec/search.md). Code: [`@opden-data-layer/object-search`](../../../../libs/object-search/src/index.ts) (document, sink, source, queue, rebuild), chain-indexer handler and worker.

## Document

`buildObjectSearchDocument` uses only `ObjectViewService.resolve` with the platform governance (`GovernanceCacheService.resolvePlatform()`), default locale `en-US`:

| Field | Source |
|---|---|
| `name` | Base-view winner of `name`; `name_norm` = `normalizeSearchText(name)` (the "starts with" boost) |
| `names`, `titles`, `descriptions` | Winners of `name` / `title` / `description` for `en-US`, every other locale present and the fallback (a locale nothing carries) — only when these updates carry more than one locale. Descriptions cut at 5000 characters |
| `identifiers` | Valid `identifier` values (`value_json.value`), deduplicated, sorted |
| `locality` | Winning `address.locality` |
| `geo` | Coordinates of the winning `geo` update |
| `group_key`, `weight`, `created_at` | `meta_group_id ?? object_id`, `weight`, `created_at` of `objects_core` |

No document (the row is deleted) when `objects_core.status` is not `active` or the resolver drops the object (banned creator). Objects without a name get a document and are found by the words of their `object_id`.

**Vector** (`PostgresObjectSearchSink`, `simple` configuration, all text through `normalizeSearchText`): A names, B titles, C identifiers (each also without separators: `978-3-16` → `978316`), locality and `object_id` words, D descriptions. Weights are stored for later ranking; ordering does not use them yet.

**Content hash:** SHA-1 of `SEARCH_DOC_FORMAT_VERSION` and every field except `weight`. The sink rewrites a row only when its hash changed (or with `force`); a weight-only change is a separate `UPDATE … SET weight` (HOT, GIN untouched). Bump the format version whenever normalization or the vector composition changes, then run `pnpm search-docs:rebuild --all`.

## Triggers

Every path that changes a document's input enqueues the object in `object_search_docs_sync_queue`:

| Change | Where | How |
|---|---|---|
| Object created | `ObjectCreateHandler` → `OBJECT_CREATED_EVENT` | `ObjectSearchSyncHandler` enqueues |
| Update created / validity vote (`name`, `title`, `description`, `identifier`, `address`, `geo`) | `UpdateCreateHandler`, `UpdateVoteHandler` → `OBJECT_UPDATE_MUTATED_EVENT` | enqueued when the type is in `SEARCH_DOC_UPDATE_TYPES` |
| Ownership | `OWNERSHIP_CHANGED_EVENT` | enqueued (changes which updates are valid) |
| Status crosses the `active` boundary | `ObjectStatusHandler` | enqueued **in the transaction** of the status write |
| `meta_group_id` | `MetaGroupSyncHandler` | enqueued in the transaction of the write |
| `weight` | scheduler `PostExpertiseService` | enqueued in the transaction of `applyExpertiseIncrements` |
| Statuses written by `backfill:object-statuses` | script | enqueued per changed object |
| Platform governance object or one it inherits from | `GOVERNANCE_OBJECT_MUTATED_EVENT` | **warn only**: run `pnpm search-docs:rebuild --all` |

Rank votes need nothing: the document reads no `rank_score`.

## Queue

Same contract as the [object categories queues](object-categories.md#queue-contract-both-queues) (`GREATEST(enqueued_at + 1, …)` version bump; a row re-enqueued during processing survives `finishClaimed`), plus:

- **Priority:** bulk rows (migration `00078`, `search-docs:rebuild`) use `enqueued_at = 0`; live events use the unix time. The claim orders `last_attempt_at NULLS FIRST, enqueued_at DESC`, so a live change is applied within one tick even while 800k bulk rows wait.
- **Failures are never dropped:** a failing id is released (`releaseClaimed`) and retried after the retry window (60 s), with an `error` log including `attempts`. A missing document hides an active object.

## Worker (`ObjectSearchDocsWorker`)

Every `OBJECT_SEARCH_DOCS_INTERVAL_MS` (3000) with a re-entrancy guard: `claimBatch(OBJECT_SEARCH_DOCS_BATCH_SIZE = 200)` → `ObjectSearchRebuildService.rebuild(ids, platformGovernance)` → `finishClaimed`; repeats while batches come back full, at most `OBJECT_SEARCH_DOCS_MAX_BATCHES_PER_TICK` (10). When a batch throws, its ids are retried one by one.

`ObjectSearchRebuildService`: load (the loader **throws** on a database error — an empty result would delete documents) → build per loaded core row → `upserts` or `deleteIds` → `apply` on every sink (`OBJECT_SEARCH_SINKS`). Ids without a core row are ignored (the FK cascade already removed the document).

## Status

`objects_core.status` is materialized by [`ObjectStatusHandler`](object-status.md); every listing filters `status = 'active'`.

- **Write side:** a document exists only while the object is `active`. The status write and its enqueue share one transaction, and live rows are claimed before bulk rows.
- **Read side:** Discover lists, facets, category trees and the Favorites map are driven from `objects_core` with `status = 'active'`; the document only narrows that set. The header list goes through `projectByObjectIds`, which loads active cores only. The only exposure is the type counts of `GET /search/counts`: for at most one worker tick a just-deactivated object can still be counted.

## Invariants

- One row per active object; no row for a non-active object (`pnpm search-docs:rebuild --check` reports both as 0).
- Texts are the resolver's winners only; rejected and losing values never match.
- `object_search_docs` is written only through `ObjectSearchSink`; the worker never writes it directly.

## Known gaps

- **Platform governance change:** no automatic rebuild (warning only).
- **Voter-power drift:** validity weights change with `user_object_powers`, which does not enqueue (same as tags and categories).
- The words of `object_id` are indexed (weight C), and ids are usually slugs of the first name: a renamed object stays findable by the words of its old name when they are in its id (`kvu-kisamos-greek-taverna`).
- CJK and Thai text without spaces is one word, matched by prefix only. No accent folding (`café` ≠ `cafe`).

## Verification

- `pnpm nx test object-search`, `pnpm nx test chain-indexer`; Postgres specs in query-api (`object-search-docs.db.spec.ts`, `search.repository.db.spec.ts`) with `POSTGRES_TEST_URL`.
- `pnpm search-docs:rebuild --check` on a live database ([runbook](../../../operations/object-search-docs-rebuild.md)).
