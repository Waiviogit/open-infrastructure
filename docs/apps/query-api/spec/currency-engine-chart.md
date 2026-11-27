---
id: query-api-currency-engine-chart
title: Hive Engine token price chart
description: WAIV (or another base) price series per period from hive_engine_rates, with period change and USD low/high.
type: spec
status: active
scope: query-api
tags: [query-api, currency, waiv, hive-engine]
updated_at: 2026-11-27
related:
  - docs/apps/query-api/spec/waiv-endpoints.md
  - docs/apps/web/spec/pages/waiv/waiv-page.md
---

# Hive Engine token price chart

**Back:** [overview](overview.md) · **WAIV page:** [waiv-endpoints.md](waiv-endpoints.md)

`GET /query/v1/currency/engine/chart?period=&base=` → `CurrencyQueryService.engineChart` (`libs/currency/src/lib/currency-query.service.ts`). Window rules and point helpers: `libs/currency/src/lib/currency-engine-chart.ts`. MCP tool: `get_engine_chart`. Port of the legacy currencies-api `engine-chart`.

## Periods

| `period` | Rows | Window | Points |
|----------|------|--------|--------|
| `1d` | ordinary (~5 min samples) by `created_at` | last 24 h | one per 5 min (~288) |
| `7d` | ordinary by `created_at` | last 7 × 24 h | newest sample per 30 min (~336) |
| `1m` / `3m` / `6m` / `1y` / `2y` | daily | 31 / 93 / 186 / 372 / 744 days back | one per day |
| `all` | daily | whole history | one per day |

Unknown periods fall back to `1m`. `base` defaults to `WAIV`.

The `date` column of `hive_engine_rates` is a day, so intraday windows read `created_at`; an earlier version de-duplicated intraday rows by day and returned ~2 points for `1d`. Index: migration `00080_hive_engine_rates_ordinary_created_at` (partial `(base, created_at DESC) WHERE is_daily = false`).

## Response

```json
{
  "result": [{ "dateString": "2026-11-27", "timestamp": "2026-11-27T10:05:12.000Z", "rates": { "HIVE": 0.181, "USD": 0.0066 } }],
  "change": { "HIVE": -2.13, "USD": -0.58 },
  "lowUSD": 0.0065,
  "highUSD": 0.0068
}
```

- `result` is newest first. The first point is always the latest ordinary row (the live head); daily windows drop the daily row of the head's own day.
- `timestamp`: sample time for intraday points, `00:00Z` of the day for daily points. `dateString` is kept for older consumers.
- `change`: percent between the head and the oldest point (legacy start prices when the oldest is 0).
- `lowUSD` is the legacy start price `0.005` for `all`; `highUSD` falls back to it when there is no data.

## Verification

```bash
pnpm nx test currency --testPathPatterns=engine-chart
curl -s 'localhost:7000/query/v1/currency/engine/chart?period=1d' | jq '.result | length'
```
