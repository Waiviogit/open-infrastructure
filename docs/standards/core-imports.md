# Core library import routing

Agents and contributors: use this table before importing from `@opden-data-layer/core`.

CI enforces boundaries via `pnpm check:core-imports` (see [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml)).

## Libraries

| Package | Scope | Contains |
|---------|-------|----------|
| `@opden-data-layer/core` | `scope:domain` | Object/update registries, Hive parsers, constants, pure utils. **No Nest, no Kysely row types in barrel.** |
| `@opden-data-layer/common` | `scope:shared` | Dependency-free helpers (no internal libs, dhive or `node:*`): Hive account name grammar, `buildRedisKey`. Web-safe, client components included. |
| `@opden-data-layer/odl-db-types` | `scope:shared` | Kysely `OdlDatabase` and PostgreSQL row types (`Post`, `ObjectUpdate`, `JsonValue`, …). Type-only surface. |

## Import cheat sheet

| Symbol / use case | Import |
|-------------------|--------|
| `UPDATE_REGISTRY`, `UPDATE_TYPES`, `OBJECT_TYPE_REGISTRY` | `@opden-data-layer/core/update-registry`, `/update-types`, `/object-type-registry` |
| `isHiveAccountName`, `normalizeHiveAccountInput`, `HIVE_ACCOUNT_NAME_MIN_LENGTH` / `_MAX_LENGTH` | `@opden-data-layer/common` (also re-exported as `isHiveAccountName` by `@opden-data-layer/hive-account`) |
| `buildRedisKey`, `RedisPurpose` | `@opden-data-layer/common` (core barrel re-exports it for existing callers) |
| `localeFromHeaders`, `DEFAULT_LOCALE` | `@opden-data-layer/core` (barrel → `http/locale-from-headers`) |
| `buildObjectChannelId`, `buildOslMessageId` | `@opden-data-layer/core/utils/osl-messaging` or core barrel |
| `buildOblOnBehalfMemo`, `parseOblOnBehalfMemo` | `@opden-data-layer/core/utils/obl-on-behalf-memo` or core barrel |
| `computeDmPairHash` | `@opden-data-layer/core/utils/osl-messaging-crypto` (Node `crypto` — server/indexer only) |
| `detectPostingSigner` | `@opden-data-layer/core/utils/hive-tx-signer` subpath only (dhive — not in barrel) |
| `Post`, `OdlDatabase`, `JsonValue`, `ChannelMember`, … | `@opden-data-layer/odl-db-types` |
| `ReqLocale` (Nest decorator) | `apps/query-api/src/http/locale-header.decorator` |

## Hive account name checks — known debt

`isHiveAccountName` (`@opden-data-layer/common`) is the single grammar for **user input and UI** (web forms, pay-on-behalf memo, agent-wallet, indexer backfill). It matches hived `is_valid_account_name`: 3–16 chars, dot-separated segments of 3+ chars, each starts with a letter, ends with a letter or digit, `a-z0-9-` only.

These older checks are intentionally left as they are and may accept names like `a.bcd`:

- `hiveAccountNameSchema` in the update registry (`libs/core/src/update-registry`) — changing it changes which on-chain updates are indexed;
- the local schema in `apps/query-api` `hive-account-created-dates.schema.ts`;
- the account regex in `legacy-update-tx.ts`;
- the mention matcher in `social-content-html.ts`;
- account name normalizers in `auth-api`, `query-api` and `chain-indexer`.

Move one of them to `common` only together with a decision on what happens to already indexed data.

## Web (`apps/web`)

- Barrel `@opden-data-layer/core` is safe for **Server Components** after the core split.
- **Client components (`'use client'`):** use subpaths for large registries to improve tree-shaking; do not import the core barrel unless only `import type`.
- **DB types:** `import type { … } from '@opden-data-layer/odl-db-types'` only — no runtime imports in client bundles.

## Nest apps

- Repositories and database modules: import row types from `@opden-data-layer/odl-db-types`.
- Domain logic mixed with registries: split imports — domain from `core`, DB types from `odl-db-types`.

## Verification

```bash
pnpm check:core-imports
pnpm typecheck:web
pnpm typecheck:nest
pnpm nx test core common
```
