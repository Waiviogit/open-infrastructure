---
id: web-pages-waiv
title: WAIV token page
description: /waiv price chart, supply and tokenomics; /waiv/swaps trading history of every account in the WAIV pool.
type: spec
status: active
scope: web
tags: [web, page, waiv, currency]
updated_at: 2026-11-27
related:
  - docs/apps/query-api/spec/waiv-endpoints.md
  - docs/apps/query-api/spec/currency-engine-chart.md
  - docs/apps/web/spec/pages/user-profile/routes/currency-market-widget.md
---

# WAIV token page

**Back:** [site map](../index.md) · **API:** [waiv-endpoints.md](../../../../query-api/spec/waiv-endpoints.md), [currency-engine-chart.md](../../../../query-api/spec/currency-engine-chart.md)

Replaces legacy `waivio.com/waiv-page?display=widget` (tabs "WAIV stats" / "Trading history"). Entry point: **View detailed charts** under the expanded WAIV row of the wallet [Market widget](../user-profile/routes/currency-market-widget.md).

## Routes

| URL | Page | Data (server, first paint) |
|-----|------|----------------------------|
| `/waiv` | WAIV stats | `GET /query/v1/waiv/stats` + `GET /query/v1/currency/engine/chart?period=1m` in parallel |
| `/waiv/swaps` | Trading history | `GET /query/v1/waiv/swaps?limit=20` |

`app/(app)/waiv/layout.tsx` holds the title and the two route tabs (`WaivPageShell`, `OptimisticNavLink prefetchShell` inside `OptimisticNavProvider`); each page has its own `loading.tsx` skeleton. Module: `src/modules/waiv-token/` (server reads via `@/modules/waiv-token/server`).

## `/waiv` — stats

1. **Price card** (`WaivPriceCard`): latest price, change over the selected period (▲/▼ + success/error), low/high of the plotted points, HIVE price. Period pills `1d 7d 1m 3m 6m 1y 2y all` (default `1m`) switch locally: the chart stays on screen at reduced opacity while `GET /api/waiv/chart?period=` loads; loaded periods are kept for the visit. An error shows inline with **Try again**.
2. **Price chart** (`PriceAreaChart`, hand-drawn SVG in `presentation/charts/`, no chart library): 2px accent line drawn in on each load (skipped with `prefers-reduced-motion`), gradient area, hairline gridlines at round USD ticks, UTC time ticks chosen by span (hours, weekdays, days, months, years), end dot. Pointer/touch: crosshair snaps to the nearest point by time; tooltip shows USD, HIVE and the UTC time. Keyboard: the chart is focusable; ←/→, Home/End move the point, Esc clears. Width is measured with `ResizeObserver`; the server renders at a fixed width.
3. **Stat tiles:** tokens in circulation, market capitalization, WAIV power (staked), accounts holding WAIV, monthly active accounts, annual inflation. Unavailable values show `—`.
4. **WAIV tokenomics:** thin segmented bars with a legend list (name, share, amount) for staking (power / liquid), inflation distribution (rewards pool / development fund / liquidity providers) and rewards pool (authors / curators); a meter for the development fund (distributed vs available per month, WAIV + USD).

Chart colors: categorical tokens `--color-chart-1…3` ([theme.md](../../theme.md)) in fixed order; chart text uses text tokens only.

## `/waiv/swaps` — trading history

`WaivSwapsFeed`: RSC first page → `useSyncedPaginatedList`; next pages on scroll (`useInfiniteScroll` sentinel + `sr-only` button) through `GET /api/waiv/swaps?cursor=`. Row: left — avatar + `@account` (profile link), Buy/Sell badge (receiving WAIV = buy), relative time filled after mount; right — the wallet history swap block: `WalletDualAmount` (`- paid` red, `+ received` green, quantities via `formatWalletHistoryQuantity`, both from the client-safe entry `@/modules/user-wallet/history-ui` — the `user-wallet` barrel also carries server queries with `'use cache'`, which break a client bundle) and the rate `X received per paid` under it.

## BFF

| Route | Delegates to | Errors |
|-------|--------------|--------|
| `GET /api/waiv/chart?period=` | `getWaivChart` → engine chart, mapped oldest first | `400 invalid_period`, `503 unavailable` |
| `GET /api/waiv/swaps?cursor=` | `getWaivSwapsPage` | `400 invalid_cursor`, `503 unavailable` |

## Verification

```bash
pnpm nx test web --testPathPatterns=waiv-token
pnpm nx run web:typecheck
```

Manual: open a wallet (`/@:name/transfers`), expand WAIV in Market → **View detailed charts** → `/waiv`; switch every period, hover and arrow-key the chart; open **Trading history** and scroll to load more; check light/dark and 375 px width.
