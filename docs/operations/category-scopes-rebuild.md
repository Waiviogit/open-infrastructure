---
id: docs-operations-category-scopes-rebuild
title: Category scopes rebuild
type: spec
status: active
scope: platform
tags: [platform, ops, categories]
updated_at: 2026-11-24
related:
  - docs/apps/chain-indexer/spec/object-categories.md
  - docs/apps/query-api/spec/categories.md
  - docs/operations/migrations.md
---

# Category scopes rebuild (`pnpm categories:rebuild`)

Rebuilds the precomputed category trees (`object_categories_related`) directly in Postgres, without the chain-indexer queue, and reports what clients see change. Use it after a deploy that needs the trees at once, when the Discover or Favorites rail is empty, and when tuning the category algorithms.

The rebuild is the one chain-indexer uses (`CategoryScopeRebuildService` in [`@opden-data-layer/category-scopes`](../../libs/category-scopes/src/index.ts)), so a script run and a queue rebuild write the same rows. A transaction-scoped advisory lock per scope serializes a script rebuild with a worker rebuild of the same scope.

Script: [`scripts/rebuild-category-scopes.ts`](../../scripts/rebuild-category-scopes.ts).

## Options

| Flags | Rebuilds |
|-------|----------|
| none | every type scope (Discover) + every user scope (Favorites) |
| `--types` / `--type product` (repeatable) | every category type / the named types |
| `--users` / `--user alice` (repeatable) | every `account:type` scope / every category type of the named accounts |
| `--global` | also the global scope |
| `--dry-run` | each scope rebuilt and reported inside a transaction that is rolled back |
| `--verbose` | also stored categories added / removed / recounted, and why each root category is hidden |
| `--concurrency N` | user scopes in parallel (default 4, max 16) |

User scopes = accounts with favorites or authored posts of a category type, plus every stored user scope of a category type (so a scope that lost its members is emptied). Exit code 1 when any scope failed.

## Output

Per type scope (always printed):

```
type product: total 58 groups, 8 stored categories (+0 / -0 / 2 recounted), 28 ms
    root (3): Electronics 34, Garden 6, Kitchen 5
    hidden at root: Everything 48 (83% > 60%), Audio 20 (under a larger root category, or past the cap), Cables 2 (< 3)
    + now visible: Garden 6
```

- `root` is what the unfiltered Discover root shows right after the rebuild (display rules, root dominance and the cap, as query-api).
- `root: EMPTY — no active object of this type has a category` → `object_categories` has no rows for the type (category updates not parsed or not voted).
- `root: EMPTY — none of N categories passes the display rules` → categories exist, but every one has fewer than 3 groups or more than 60% of the type.
- `+ now visible` / `- no longer visible` compare with the rows before the rebuild.

User scopes print only when their root changed (`--verbose`: any change), then a summary line.

## Running

Local (repo root, `.env`):

```bash
pnpm categories:rebuild --types --dry-run --verbose
pnpm categories:rebuild
```

On a VPS through the migrator image (same pattern as [migrations](migrations.md)):

```bash
docker compose -p apps --env-file .env -f docker-compose.staging.apps.yml --profile tools run --rm \
  migrator pnpm categories:rebuild --types --dry-run --verbose

docker compose -p apps --env-file .env -f docker-compose.staging.apps.yml --profile tools run --rm \
  migrator pnpm categories:rebuild
```

The type scopes also rebuild from the chain-indexer queue (rate limited, see [object categories](../apps/chain-indexer/spec/object-categories.md#throttling-type-scopes)); the script does not touch that throttle. To recompute the per-object `object_categories` rows first, use `pnpm backfill:object-categories` and let chain-indexer drain the queue.
