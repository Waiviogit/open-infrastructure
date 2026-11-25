---
id: docs-operations-object-search-docs-rebuild
title: Object search documents rebuild
description: Runbook for pnpm search-docs:rebuild — modes (--all, --repair, --queued, --object-id, --check), options, when to run it, local and migrator-image commands, and the rollout order of the object search read model.
type: spec
status: active
scope: platform
tags: [platform, ops, search]
updated_at: 2026-11-25
related:
  - docs/apps/chain-indexer/spec/object-search-docs.md
  - docs/architecture/adr/search-read-model.md
  - docs/operations/migrations.md
---

# Object search documents rebuild (`pnpm search-docs:rebuild`)

Recomputes rows of [`object_search_docs`](../apps/chain-indexer/spec/object-search-docs.md). It works **through the queue**: it enqueues, then drains with the worker's own contract (`claimBatch` → `ObjectSearchRebuildService.rebuild` → `finishClaimed`). The script and the chain-indexer worker are both claimers (`SKIP LOCKED`), and a change made while a batch is processed re-enqueues the object, so neither overwrites a newer document with an older one.

Script: [`scripts/rebuild-object-search-docs.ts`](../../scripts/rebuild-object-search-docs.ts).

## Modes (exactly one)

| Mode | Does |
|---|---|
| `--all` | Enqueue every `objects_core` row, then drain |
| `--repair` | Enqueue active objects without a document and documents of non-active objects, then drain |
| `--queued` | Drain what is already queued |
| `--object-id <id>` (repeatable) | Enqueue those ids, then drain |
| `--check` | Read-only: queue length, active objects without a document, documents of non-active objects. Exit code 1 when any is non-zero |

| Option | Effect |
|---|---|
| `--dry-run` | Build documents for the selected ids and print counts; no enqueue, no write |
| `--batch-size N` | Ids per batch (default 1000, max 5000) |
| `--force` | Rewrite rows even when the content hash is unchanged |
| `--default-governance` | Allow an empty `GOVERNANCE_OBJECT_ID` (empty governance snapshot) |

**Governance must be explicit.** Winners depend on the platform governance, so the script reads `GOVERNANCE_OBJECT_ID` (the value chain-indexer uses) and stops before doing anything when it is empty (unless `--default-governance`), or when that object does not exist or is not of type `governance`. It prints a summary of the snapshot first; check it matches the environment.

Output: a progress line every 20 batches, then claimed / upserted / deleted / failed / still queued. Exit code 1 when any id failed (the row stays queued; the worker retries it).

## When to run

- First deploy of the read model (rollout below).
- After a change of the platform governance object or an object it inherits from (chain-indexer logs a warning).
- After a Mongo import or `pnpm backfill:object-statuses` on a large set (both write outside the indexer; the backfill enqueues, `--queued` drains at once).
- After bumping `SEARCH_DOC_FORMAT_VERSION` (`--all`).
- When `--check` is not clean: `--repair`.

## Running

Local (repo root, `.env`):

```bash
pnpm search-docs:rebuild --check
pnpm search-docs:rebuild --all --dry-run
pnpm search-docs:rebuild --all
```

On a VPS through the migrator image (same pattern as [migrations](migrations.md)):

```bash
docker compose -p apps --env-file .env -f docker-compose.staging.apps.yml --profile tools run --rm \
  migrator pnpm search-docs:rebuild --all

docker compose -p apps --env-file .env -f docker-compose.staging.apps.yml --profile tools run --rm \
  migrator pnpm search-docs:rebuild --check
```

## Rollout order (first deploy)

1. Run the migrator (`latest`): creates the tables and enqueues every object. Old apps keep working.
2. Deploy `chain-indexer` and `scheduler`. From here every change enqueues and the worker fills the table. This comes **before** the rebuild: with the old indexer running, objects changed after the rebuild would be missed.
3. `pnpm search-docs:rebuild --all` in the migrator image (about 3 minutes for 833k objects on a local copy; a rerun with unchanged content is faster since only weights are written). It also picks up objects created between steps 1 and 2.
4. `pnpm search-docs:rebuild --check`: empty queue, no active object without a document, no document of a non-active object.
5. Deploy `query-api` and `web`.

Rollback: redeploy the previous `query-api` image. Nothing old is dropped until the separate cleanup migration.
