# common

`@opden-data-layer/common` — `scope:shared` library with no internal or third-party runtime
dependencies. Safe for every consumer, including `apps/web` client components (no Nest, dhive or
`node:*` imports).

- `hive-account` — `isHiveAccountName` (hived grammar), `normalizeHiveAccountInput`, length bounds.
- `markdown` — `markdownToPlainText` (one-line plain-text preview of a markdown / HTML body).
- `redis` — `buildRedisKey`, `RedisPurpose` (key convention from `AGENTS.md`).

Run `pnpm nx test common` for unit tests.
