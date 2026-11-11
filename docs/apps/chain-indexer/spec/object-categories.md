---
id: docs-apps-chain-indexer-spec-object-categories
title: Object categories
description: Materialize governance-resolved **`category`** update values per object (`object_categories.category_names`) and per-scope category aggregates (`object_categories_related`) for Favorites category navigation.
type: spec
status: active
scope: chain-indexer
tags: [chain-indexer, object-categories]
updated_at: 2026-11-11
related:
  - docs/apps/chain-indexer/spec/overview.md
  - docs/apps/chain-indexer/spec/odl-pipeline.md
  - docs/apps/query-api/spec/users-favorites-endpoint.md
  - docs/apps/query-api/spec/categories.md
  - docs/README.md
---

# Object categories (`object_categories`, `object_categories_related`)

**Back:** [chain-indexer overview](overview.md) · **Related:** [meta-group-sync](meta-group-sync.md), [object-status](object-status.md), [Data model flow](../../../spec/data-model/flow.md)

## Purpose

Materialize governance-resolved **`category`** update values per object (`object_categories.category_names`) so the query layer does not join `object_updates` / validity for category navigation.

Aggregated **`object_categories_related`** rows per **`scope_type` / `scope_key`** give query-api the candidate categories (`related_names`, `group_keys`) for `GET /query/v1/users/:name/categories`. Displayed counts are computed live by query-api ([categories.md](../../query-api/spec/categories.md)).

## Scopes

- **Global** — `('global', '_')`: all active objects; `group_keys` stored as empty arrays.
- **User** — one scope per account and **category type**: `scope_key = buildUserCategoryScopeKey(account, objectType)` → `alice:recipe` (`@opden-data-layer/core`). Category types are `CATEGORY_OBJECT_TYPES`: registry types whose `supported_updates` include `category` (today book, product, recipe, service, service_offer, service_request). Book and product are separate scopes.
- `parseUserCategoryScopeKey` returns `null` for legacy keys (`alice`, `alice:book,product`) and non-category types; the worker deletes such scopes instead of rebuilding them.

**User scope membership** is the Favorites scope defined in [users-favorites-endpoint.md](../../query-api/spec/users-favorites-endpoint.md) (favorites ∪ authored post objects, deselect and hide-flag rules, active only), restricted to the single `objects_core.object_type` of the scope. **`object_ownership` is not part of it.** The hide flag per type comes from `resolvePostLinkedObjectTypes` / `getPostLinkedHideFlagKey` in `@opden-data-layer/core`.

Sentinel category name **`__uncategorized__`** carries the count of distinct groups (`COALESCE(meta_group_id, object_id)`) in scope with empty `category_names`. It is written only when that count is above 0; an empty scope has **no rows** at all.

## Triggers

Per-object queue (`object_categories_sync_queue`), via **`CategoryMutatedEvent`**:

- **`update_create`** / **`update_vote`** on a `category` row (including `vote === 'remove'`).
- **`MetaGroupSyncHandler`** after `objects_core.meta_group_id` changes.

`CategoryMutatedEvent` enqueues **only** the object recompute. Scopes are enqueued after the new row is written (below), so a scope is never rebuilt from stale `category_names`.

Scope queue (`object_categories_related_sync_queue`):

| Source | Enqueues |
|--------|----------|
| `ObjectCategoriesWorker`, when `category_names` (as a set) or `meta_group_id` changed | global + `(account, objectType)` for every favoriter and post author of the object (category types only); same transaction as the upsert |
| `ObjectActiveStateChangedEvent` (status crossed `active` ↔ inactive) | global + `(account, objectType)` for favoriters and post authors (category types only) |
| `ObjectFavoriteChangedEvent`, `UserMetadataChangedEvent`, `UserShopDeselectChangedEvent`, `PostObjectChangedEvent` | every category type scope of that account, one multi-row insert |

Emitters:

- [`update-create.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/update-create.handler.ts), [`update-vote.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/update-vote.handler.ts), [`meta-group-sync.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/meta-group-sync.handler.ts)
- [`object-status.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/object-status.handler.ts) (`ObjectActiveStateChangedEvent`)
- [`favorite.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/favorite.handler.ts), [`shop-deselect.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/shop-deselect.handler.ts), [`user-metadata.handler.ts`](../../../../apps/chain-indexer/src/domain/osl-parser/handlers/user-metadata.handler.ts)
- [`post-upsert.service.ts`](../../../../apps/chain-indexer/src/domain/hive-comment/post-upsert.service.ts), [`comment-post-object-bind.service.ts`](../../../../apps/chain-indexer/src/domain/hive-comment/comment-post-object-bind.service.ts)

Listener: [`category-sync.handler.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/handlers/category-sync.handler.ts). Scope key resolution: [`user-category-scope-enqueue.service.ts`](../../../../apps/chain-indexer/src/domain/odl-parser/user-category-scope-enqueue.service.ts).

## Queue contract (both queues)

- **Claim:** `FOR UPDATE SKIP LOCKED`, sets `last_attempt_at`, increments `attempts`; rows with `last_attempt_at` older than the retry window are claimable again.
- **Re-enqueue:** `ON CONFLICT DO UPDATE SET enqueued_at = GREATEST(enqueued_at + 1, EXCLUDED.enqueued_at), attempts = 0`. `enqueued_at` is a version: every re-enqueue makes it strictly larger, even within the same second.
- **Finish:** `deleteClaimed` deletes only when `enqueued_at <= claimed.enqueued_at`. If the row was re-enqueued while the worker processed it, the row stays and `last_attempt_at` is cleared, so the next batch processes the newer change.
- **Failure:** below max attempts `last_attempt_at` is cleared (retry next batch); at max attempts the row is finished as above.

## Algorithms

### Per-object (`ObjectCategoriesWorker`)

1. Claim rows from `object_categories_sync_queue`.
2. Load [`AggregatedObject`](../../../../libs/objects-domain/src/types/aggregated-object.ts); resolve **`platform`** governance (`GovernanceCacheService.resolvePlatform()`).
3. **`ObjectViewService.resolve`** with `update_types: [UPDATE_TYPES.CATEGORY]`; keep up to **15** VALID winners.
4. In one transaction: upsert **`object_categories`** (`meta_group_id` from `objects_core`, `updated_at_seq` from max selected `event_seq`) and, when the row changed (see Triggers), enqueue the scopes.
5. Finish the queue row (queue contract).

Constants: [`object-categories.constants.ts`](../../../../apps/chain-indexer/src/constants/object-categories.constants.ts).

### Per-scope (`ObjectCategoriesRelatedWorker`)

1. Claim rows from `object_categories_related_sync_queue`.
2. **Global:** aggregate all active `objects_core`.
3. **User:** `parseUserCategoryScopeKey`; `null` → `deleteUserScope(key)`, warn, finish the task. Otherwise load `user_metadata` flags and `user_shop_deselect` ids and aggregate the scope membership above.
4. `related_names` = co-occurrence on the same `group_key`. Replace all rows of the scope in one transaction (delete + insert).

## Invariants

- After a category create/vote, `object_categories` matches `ResolvedObjectView` for `category` under platform governance (up to 15 strings).
- A user scope row exists only for a canonical `account:type` key of a category type.
- A user scope never counts ownership-only objects, objects of another type, or inactive objects.
- An empty scope has no rows; `__uncategorized__` is never stored with count 0.
- A scope enqueued while it is being processed is processed again.

## Migration and backfill

- Migration **`00073_object_categories_related_per_type_scopes`** deletes legacy user scope rows and queue rows (no `:`, empty account, or a type outside the frozen list book, product, recipe, service, service_offer, service_request) and enqueues every `account:type` pair from favorites ∪ post authors plus every surviving per-type user scope.
- [`scripts/backfill-object-categories.ts`](../../../../scripts/backfill-object-categories.ts): enqueues category objects, the global scope and every `(account, type)` scope with one `INSERT … SELECT` (`--user` limits to one account, `--only-objects` / `--only-scopes`, `--dry-run`). `--cleanup-legacy-scopes` deletes user scope rows and queue rows whose key `parseUserCategoryScopeKey` rejects. Run chain-indexer until both queues drain.

## Verification

- `pnpm nx test chain-indexer --testPathPatterns="category-sync|object-categories|object-status"`
- `pnpm test:db:up`, then `POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test chain-indexer --testPathPatterns=object-categories-related.repository.db` (scope SQL and queue race; skipped without `POSTGRES_TEST_URL`)
- `pnpm test:db` (migration `00073` spec)
