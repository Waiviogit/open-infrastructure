---
description: 
globs: apps/chain-indexer/src/**
alwaysApply: false
---

# chain-indexer — agent rules

Specialization for this app. **Shared policy** (monorepo, NestJS layering, Kysely, logging, testing, Nx) lives in the repo root [`AGENTS.md`](../../AGENTS.md). Do not duplicate that here.

## Role

Background indexer: NestJS **application context** only — **no HTTP server**, no controllers.

## Module wiring (reference)

`ConfigModule` → `EventEmitterModule` → `ScheduleModule` → `IpfsClientModule` → `RedisClientModule` → `HiveClientModule` → `DatabaseModule` → `RepositoriesModule` → `HiveParserModule` → `GovernanceModule` (see `main.module.ts`).

## Source layout

```
src/
  config/          env.validation.ts + chain-indexer.config.ts
  constants/       app-scoped constants (hive-parser)
  database/        DatabaseModule, KYSELY token, Database type
  repositories/    RepositoriesModule + repository classes (Kysely only, no business logic)
  domain/          feature areas: governance/, hive-parser/, hive-comment/, hive-social/, hive-vote/, odl-parser/, notification-adapter/
```

- Each `domain/<feature>/` has its own `*.module.ts`; use a barrel `index.ts` when the area exports a public surface.
- **Repositories**: single `RepositoriesModule` — register providers there; repositories are data access only (see root AGENTS.md).

## Workers

Files named `*.worker.ts`: long-running or periodic background work (queue draining, sync loops). Injectable Nest providers; **no HTTP**.

## ODL custom JSON

- **Handlers** implement `OdlActionHandler` (`action` + `handle(payload, ctx)`). Register in `OdlParserModule` / parser maps — **add new behavior with new handler classes**, not by growing orchestrators.
- **Guards** (`domain/odl-parser/guards/`): implement `WriteGuard`; register via the `WRITE_GUARDS` token and `WriteGuardRunner`. Add a new guard as a **new class**, not new branches in existing guards.

## Governance events

- Emit **`GovernanceObjectMutatedEvent`** (and constant `GOVERNANCE_OBJECT_MUTATED_EVENT`) via `EventEmitter2` when governance-related writes occur.
- Subscribers (e.g. cache invalidation) live in dedicated services — keep handlers thin.

## Search documents

See [object search documents](../../docs/apps/chain-indexer/spec/object-search-docs.md).

- Documents are built by `libs/object-search` and written through `ObjectSearchSink` (`OBJECT_SEARCH_SINKS`); the worker never writes `object_search_docs` directly.
- Any code path that changes what a document contains (search update types, validity votes, status, ownership, `meta_group_id`, `weight`) must enqueue the object in `object_search_docs_sync_queue`; a change of `objects_core` does it in the same transaction as the write.

## Cross-cutting

- **Hive block processing** uses `HiveProcessorModule` from `@opden-data-layer/hive-processor` and parsers under `hive-parser` / `odl-parser` — follow existing patterns for new operations.
