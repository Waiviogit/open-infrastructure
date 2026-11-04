---
id: docs-standards-test-postgres-harness
title: Test Postgres harness
description: Local disposable Postgres + Redis for integration specs and the query-api e2e suite.
type: spec
status: active
scope: platform
tags: [testing, postgres]
related:
  - docs/standards/testing-rules.md
---

# Test Postgres harness

Integration specs that need real Postgres constraints (e.g. activity dedup unique index) use a **separate** compose file — never the dev database.

## Start / stop

```bash
pnpm test:db:up    # docker compose -p odl-test -f docker-compose.test.yml
pnpm nx test migrations
pnpm test:db:down
```

Or `pnpm test:db` (up → test → down).

- Port **55432** (local), credentials `test` / `test`, database name **`test`**
- Image: `postgis/postgis:18-3.6` (PostGIS + pg_trgm required by migrations)
- Data on **tmpfs** — destroyed when the container stops
- Redis service `redis-test`: port **56379** (`REDIS_TEST_PORT`), `redis:7-alpine`, no persistence. Use it instead of the dev Redis on 6379 for anything that needs `REDIS_URI`

## Library

`@opden-data-layer/test-postgres`:

- `assertTestDatabase(url)` — refuses any database name other than exactly `test`
- `withRollback(db, fn)` — runs `fn` in a transaction that always rolls back
- `createTestDb()`, `waitForTestPostgres()`, `resolveTestPostgresUrl()`

Migrations run in `libs/migrations/src/test/global-setup.ts` via `migrateToLatest` from `@opden-data-layer/migrations` (not in test-postgres).

## E2E (query-api)

```bash
pnpm e2e:query-api   # test:db:up → nx e2e query-api-e2e → test:db:down (down also on failure)
```

`apps/query-api-e2e` builds `query-api` (`dependsOn: query-api:build`) and its global setup:

1. runs `src/support/prepare-test-db.ts` through `tsx` — `waitForTestPostgres`, `assertTestDatabase`, `migrateToLatest`;
2. starts `dist/apps/query-api/main.js` with **cwd = `dist/apps/query-api`** (so no repo `.env` is loaded) and an explicit env: `POSTGRES_*` from `POSTGRES_TEST_URL`, `REDIS_URI=redis://127.0.0.1:56379`, `JWT_SECRET`, `PORT` (inherited `POSTGRES_*`, `REDIS_*`, `JWT_*` are dropped);
3. waits for the port. Teardown sends SIGTERM, then SIGKILL.

Port and base URL have one source: `src/support/e2e-env.ts` (default **7990**, override with `QUERY_API_E2E_PORT`).

Fixtures (`src/support/fixtures/`) commit rows — the server is another process, so `withRollback` does not apply. Each spec calls its reset helper (e.g. `resetObl`) in `beforeAll`; Jest runs with `maxWorkers: 1`.

## CI

`.github/workflows/verify.yml`, both with `POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test`:

- `migrations-db` — `pnpm test:db`;
- `query-api-e2e` (paths filter: query-api, query-api-e2e, migrations, odl-db-types, test-postgres, compose) — `test:db:up` → `nx e2e query-api-e2e` → `nx test query-api` (the `*.db.spec.ts` files run instead of skipping) → `test:db:down`.

## Known gaps

`apps/knowledge-api-e2e` still reads the dev environment (`pnpm migrate` / `knowledge:reindex` against `.env`) and its teardown kills a different port than the server uses. Do not run it locally until it is moved to this harness.
