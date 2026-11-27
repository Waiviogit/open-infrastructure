---
id: query-api-waiv-endpoints
title: WAIV token page endpoints
description: WAIV stats (supply, market cap, tokenomics, holders) and the pool-wide WAIV swap history.
type: spec
status: active
scope: query-api
tags: [query-api, waiv, hive-engine, currency]
updated_at: 2026-11-27
related:
  - docs/apps/query-api/spec/currency-engine-chart.md
  - docs/apps/chain-indexer/spec/hive-engine-swaps.md
  - docs/apps/web/spec/pages/waiv/waiv-page.md
---

# WAIV token page endpoints

**Back:** [overview](overview.md) · **Price chart:** [currency-engine-chart.md](currency-engine-chart.md) · **Web page:** [waiv-page.md](../../web/spec/pages/waiv/waiv-page.md)

Controller: `apps/query-api/src/controllers/waiv.controller.ts`. Domain: `apps/query-api/src/domain/waiv/`. MCP tools: `get_waiv_stats`, `get_waiv_swaps`.

Replaces legacy waivio-api `GET /api/waiv/metrics` and `GET /api/waiv/swap-history`.

## `GET /query/v1/waiv/stats`

| Field | Source |
|-------|--------|
| `priceUsd`, `priceHive` | Latest ordinary `hive_engine_rates` row (`CurrencyQueryService.engineLatestStored`); `null` when there is no positive rate |
| `supply.circulating`, `supply.staked` | Hive Engine `tokens.tokens` `{ symbol: 'WAIV' }` → `circulatingSupply`, `totalStaked` |
| `supply.liquid` | `circulating − staked` (staked capped at circulating) |
| `marketCapUsd` | `circulating × priceUsd` |
| `annualInflationPercent`, `inflationDistribution`, `rewardsPool` | `WAIV_TOKENOMICS` in `@opden-data-layer/core` (4.73 %, 80/10/10, 50/50) |
| `developmentFund` | Hive Engine `tokenfunds.proposals` `{ fundId: 'WAIV:WAIV', active: true }`: distributed = `min(Σ amountPerDay, 137) × 30`; available = `137 × 30`; USD = × `priceUsd` |
| `accounts.holders`, `accounts.monthlyActive` | Waivio engine-statistic (`ENGINE_STATISTIC_BASE_URL`, default `https://engine.waivio.com/engine-statistic`) `/waiv/owners`, `/waiv/active-users`; `null` when it fails |
| `updatedAt` | When the response was assembled |

Pure math: `computeWaivStats` (`waiv-stats.calc.ts`).

**Caching (Redis, db0):**

| Key | TTL | Notes |
|-----|-----|-------|
| `query-api:cache:waiv:stats:v1` | 5 min (`WAIV_STATS_CACHE_TTL_SEC`) | Whole response |
| `query-api:cache:waiv:account-counts:v1` | 1 h (`WAIV_ACCOUNT_COUNTS_CACHE_TTL_SEC`) | Written only when both counts arrived, so a failure is retried on the next stats rebuild |

Cached values are re-validated with the response schema; Redis errors only log a warning.

**Errors:** Hive Engine RPC failure or a missing WAIV token → `503` (`WaivStatsUnavailableError`); nothing is cached.

## `GET /query/v1/waiv/swaps?limit=&cursor=`

Every account's swaps in the WAIV/SWAP.HIVE pool, newest first, from `hive_engine_swaps` (written by chain-indexer `MarketpoolsSwapParser`).

| Query | Rule |
|-------|------|
| `limit` | 1–50, default 20 |
| `cursor` | Opaque base64url `{ t, id }` of the last row of the previous page; anything else → `400` |

Response: `{ items, cursor, hasMore }`. Item: `id`, `account`, `avatarUrl` (`loadAccountAvatarUrls`), `transactionId`, `blockNumber`, `timestamp` (ISO), `symbolIn`, `symbolInQuantity`, `symbolOut`, `symbolOutQuantity`. `symbolIn` is what the account paid.

**Query:** `HiveEngineSwapsRepository.findWaivPoolSwaps` — `symbols @> ARRAY['WAIV','SWAP.HIVE']` (literal SQL), keyset `(block_timestamp, id) < (cursor)`, `ORDER BY block_timestamp DESC, id DESC`, `LIMIT limit + 1`.

**Index:** migration `00081_hive_engine_swaps_waiv_pool_time` — partial `(block_timestamp DESC, id DESC) WHERE symbols @> ARRAY['WAIV','SWAP.HIVE']::text[]`. The repository predicate must stay identical to the index predicate.

## Verification

```bash
pnpm nx test query-api --testPathPatterns=domain/waiv
curl -s localhost:7000/query/v1/waiv/stats
curl -s 'localhost:7000/query/v1/waiv/swaps?limit=5'
```
