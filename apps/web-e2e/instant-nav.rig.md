# instant-nav rig: apps/web

Production `instant()` suite for the Cache Components / Partial Prefetching migration
([`docs/apps/web/spec/caching.md`](../../docs/apps/web/spec/caching.md)). Config:
[`playwright.instant.config.ts`](playwright.instant.config.ts), tests: [`src/instant/`](src/instant/).

- BUILD: `next build` in `apps/web` with `EXPOSE_TESTING_API=1`, then `next start -p 3993` — both run by the Playwright `webServer`. query-api: `nx build query-api` (dependency of the `e2e-instant` target), started from `dist/apps/query-api` by `src/instant/support/start-query-api.cjs` on 7993 after it migrates and seeds the database.
- EXPOSE: `apps/web/next.config.js` → `experimental.exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === '1'`; only the rig's build sets it.
- RUN: `pnpm test:db:up && pnpm nx run web-e2e:e2e-instant` (base URL fixed: `http://localhost:3993`). CI: `web-instant-e2e` job in `.github/workflows/verify.yml`.
- TEST USER: `carol`, session = `odl_access` JWT minted by `src/instant/support/rig.ts` (`signIn`, cookie only, no page navigation) with the rig secret; state: `src/instant/support/seed.sql` — carol follows `cafe-1` and `park-2`; 30+ threads/updates; locale default (en-US).
- DRIFT: seed is minimal — no posts (Posts tab empty), only one channel message; empty-state screens differ from production data. None known for the asserted skeletons.
- CONTRACTS (one test each, `instant-navigation.spec.ts`):
  - `/feed/threads` author link → `/@alice`: profile skeleton `[aria-label="Loading profile"]`, `h1 alice` gated — passing.
  - `/feed/updates` card header → `/object/cafe-1`: object skeleton `[aria-label="Loading object"]`, `h1 Blue Cafe` gated — passing (route shell exists; a real click still needs the link to prefetch — see `nav-instant-trace.cjs`).
  - `/feed/threads` rail → `/feed/updates`: `[aria-label="Loading posts"]`, `home-updates-feed` gated — passing.
  - `/object/cafe-1` tab Details → Updates: `[aria-label="Loading object content"]`, update cards gated — passing.
  - `/@alice` tab Posts → Threads: `[aria-label="Loading profile content"]`, alice's thread gated — passing.
- LOOP: local — `pnpm test:db:up`, `pnpm nx run web-e2e:e2e-instant` (rebuilds web each run, ~1.5 min + build), edit, repeat; `pnpm test:db:down` at the end. Agent limits: none (no secrets, no deploy).
- LIVENESS: n/a; local build and start.
- WALLS:
  - Nx loads the developer `.env` into the environment: the rig never reads `POSTGRES_*` / `REDIS_URI`; overrides use `INSTANT_E2E_POSTGRES_*` / `INSTANT_E2E_REDIS_URI`, and the launcher refuses any database but `test`.
  - Playwright starts `webServer` before `globalSetup`, so migrate + seed live in the query-api launcher, before the server starts.
  - `next start` warns about `output: 'standalone'`; it still serves the build (Docker uses `node .next/standalone/server.js`).
  - The rig's `next build` replaces `apps/web/.next`; do not run it next to a developer `next start` of the same app.
