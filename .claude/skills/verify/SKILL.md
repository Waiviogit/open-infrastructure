---
name: verify
description: Runtime verification recipe for this repo — drive chain-indexer parsers with synthetic Hive / Hive Engine blocks, serve query-api from dist, and drive apps/web as a signed-in user with Playwright, all against a disposable `test` Postgres and a throwaway Redis. Use when asked to verify a change at runtime (not tests/typecheck), or to see indexer → API → web behavior end to end.
argument-hint: "[what to verify]"
---

# Verify (runtime)

Evidence = what the running code did: rows written by the real parsers, HTTP responses, screenshots.
Unit tests and typecheck are CI's job — do not run them as "verification".

**Never** point anything at the dev database or dev Redis (`.env`, `opden-data-layer-postgres-1` on 5432,
`opden-data-layer-redis-1` on 6379). Everything below uses the `test` database (port 55432) and a Redis on 56379.
The indexer harness refuses any `POSTGRES_DATABASE` other than `test`.

All commands: Git Bash, repo root.

## 1. Infra

```bash
pnpm test:db:up                                  # postgis 127.0.0.1:55432 (test/test/test) + redis 127.0.0.1:56379
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=55432 POSTGRES_DATABASE=test POSTGRES_USER=test POSTGRES_PASSWORD=test
export REDIS_URI=redis://127.0.0.1:56379
npx tsx libs/migrations/src/cli.ts latest                          # migrate the test DB (no --env-file!)
```

## 2. chain-indexer: synthetic blocks through real parsers

`scripts/indexer-harness.ts` boots the parser graph with full Nest DI (no block processors, so nothing is
pulled from Hive) and runs one step of a scenario. Production entry points: `BLOCK_PARSER`
(`HiveMainParser.parseBlock`) and `HiveEngineCompositeParser.parseBlock`. Build ops with the same
`@opden-data-layer/hive-broadcast` builders the web uses, so the payload format is real.

```bash
export NODE_PATH=$PWD/node_modules TS_NODE_PROJECT=tsconfig.base.json TS_NODE_BASEURL=. TS_NODE_TRANSPILE_ONLY=1 \
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"bundler","ignoreDeprecations":"6.0"}'
H=.claude/skills/verify/scripts/indexer-harness.ts
S=.claude/skills/verify/scripts/scenarios/obl-on-behalf.scenario.ts   # example; copy it for a new feature
for step in seed drive probe notifications; do
  node -r ts-node/register -r ./node_modules/.pnpm/node_modules/tsconfig-paths/register $H $S $step
done
```

Scenario = `export default { [step]: async (h) => … }` with `h.db` (Kysely on the test DB), `h.hiveBlock(ops)`,
`h.heBlock(refBlock, txs)`, `h.heTokenTransfer({...})`, `h.notifications()` (decoded notification Redis stream),
`h.log(label, rows)`. Steps run in separate processes; state lives in the DB. Need another Hive Engine
sub-parser or module? Add it to `HarnessModule` in the harness.

## 3. query-api over the same data

```bash
pnpm nx build query-api
(cd dist/apps/query-api && JWT_SECRET=verify-only PORT=7991 node main.js) &   # cwd outside repo root → no .env loaded
curl -s "http://127.0.0.1:7991/query/v1/obl/balance?accountA=alice&accountB=bob"
```

## 4. web as a signed-in user

```bash
(cd apps/web && AUTH_JWT_SECRET=verify-only-secret-1234 QUERY_API_URL=http://127.0.0.1:7991 npx next dev -p 3991) &
```

Then a Node script using `scripts/web-session.cjs`: `openAs(browser, 'carol', '/business/pay?for=alice&to=bob', { hydrate: 'button' })`
mints an access JWT for any username and waits for React hydration. Always wait for hydration before
typing or clicking: in dev, `networkidle` fires before hydration and input changes are silently lost.
Select inputs by label (`page.getByLabel(...)`), not by index — the header search box is the first input.
First compile of a page takes 1–2 min.

**Scroll on navigation** (list → entity page, tab switches): `scripts/scroll-entry-trace.cjs <listPath> <linkSelector> [scrollY]` (path without the leading slash — Git Bash rewrites `/…` args)
records `scrollY` every frame after the click and checks Back. Run it against a production build
(`npx next build --webpack && npx next start -p 3991` in `apps/web`) — dev adds compile latency. Seed lists
long enough to scroll (30+ rows). Rules: `apps/web/AGENTS.md` → "Scroll position on navigation".

```bash
node .claude/skills/verify/scripts/scroll-entry-trace.cjs feed/updates 'main li > a[href^="/object/"]' 2500
node .claude/skills/verify/scripts/scroll-entry-trace.cjs feed/threads 'main a[href="/@alice"]' 2500
```

**Instant navigation** (what Next waits for after a click): `scripts/nav-instant-trace.cjs <listPath> <linkSelector> [--rtt 150] [--hover 200]`
emulates a network round trip and prints click→URL / click→skeleton / click→content plus the RSC
and chunk requests. Production build only (prefetch does not run in `next dev`).

```bash
node .claude/skills/verify/scripts/nav-instant-trace.cjs feed/updates 'main li > a[href^="/object/"]' --rtt 150
node .claude/skills/verify/scripts/nav-instant-trace.cjs feed/threads 'main a[href="/@alice"]' --rtt 150 --hover 200
```

## 5. Teardown

```bash
# stop the query-api / next dev background processes (Windows: taskkill //F //T //PID <pid> from netstat -ano)
pnpm test:db:down                                # stops Postgres and Redis
```

## Gotchas

- `tsx` does not emit decorator metadata → Nest DI fails. Use `ts-node` (transpile-only) as above.
- `tsconfig-paths` is not hoisted; use `./node_modules/.pnpm/node_modules/tsconfig-paths/register`. That copy is v3,
  which needs a base URL — `tsconfig.base.json` has none, hence `TS_NODE_BASEURL=.`.
- `ScheduleModule.forRoot()` is required: workers under the parser tree inject `SchedulerRegistry`.
- `RedisClientInterface` has no `XRANGE`; the harness reads the notification stream with its own ioredis connection.
- Console errors for `ws://localhost:7200/notifications` are expected (notifications service not running).
- Wallet broadcasts (Keychain / HiveSigner) are not driven — they would hit the real chain. Verify op building
  and the indexer side instead, and say so in the report.
