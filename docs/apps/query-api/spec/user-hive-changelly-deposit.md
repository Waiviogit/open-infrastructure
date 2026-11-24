---
id: query-api-user-hive-changelly-deposit
title: User HIVE Changelly deposit endpoints
description: Any Changelly-supported coin → HIVE into a Hive account; query-api creates the exchange, the sender pays from their own wallet.
type: spec
status: active
scope: query-api
tags: [query-api, wallet, hive, changelly, deposit, mcp]
updated_at: 2026-11-24
related:
  - docs/apps/query-api/spec/user-hive-changelly-withdraw.md
  - docs/apps/query-api/spec/mcp.md
---

# User HIVE Changelly deposit endpoints

Receive HIVE paid in another coin (BTC, ETH, USDT on several networks, …) via [Changelly](https://changelly.com/). query-api creates a Changelly exchange whose payout address is a Hive account and returns the pay-in address. Nothing is signed or broadcast: the sender pays from their own wallet. The receiving account can be any Hive account, not only the caller. The reverse direction is [user-hive-changelly-withdraw.md](user-hive-changelly-withdraw.md); environment variables are the same.

Web does not use these routes; they exist for agents (MCP) and API clients.

## Limits

| Rule | Value |
|------|-------|
| Coins | Changelly coins with a `* → hive` pair and `enabledFrom` (cached in Redis `query-api:cache:changelly:deposit-currencies:v1`, 10 min) |
| Amount | Changelly pair min/max only (about $30 float, $50 fixed at the time of writing); no USD cap |
| Rate | `float` (default) or `fixed`; fixed needs `refundAddress` and has a payment deadline (`payTill`) |
| Payout | `amountTo − networkFee` HIVE (`amountToNet`), three decimals |
| Account | `:name` must exist in `accounts_current` (404 otherwise) |

## Currencies

`GET /query/v1/wallet/hive/deposit/currencies?search=&limit=`

`search` matches ticker, name, network or protocol (case-insensitive); `limit` default 100, max 1000. The ticker fixes the network: `usdt20` is ERC20, `usdtrx` TRC20, `usdtsol` Solana.

```json
{ "total": 3, "items": [{ "ticker": "usdtrx", "name": "Tether USD (TRC20)", "network": "tron", "protocol": "TRC20",
  "extraIdName": null, "fixRateEnabled": true, "payinConfirmations": 1, "payinNotification": null, "image": "https://…" }] }
```

## Range

`GET /query/v1/users/:name/wallet/hive/deposit/range?fromCoin=btc&rateType=float`

```json
{ "fromCoin": "btc", "rateType": "float", "min": "0.00047095", "max": "0.28256817" }
```

## Estimate

`POST /query/v1/users/:name/wallet/hive/deposit/estimate` — body `{ "fromCoin": "btc", "amount": 0.0005, "rateType": "float" }`

Checks the pair limits first, then quotes (`getExchangeAmount`, or `getFixRateForAmount` for fixed).

```json
{ "fromCoin": "btc", "rateType": "float", "amountFrom": "0.0005", "amountTo": "840.471", "networkFee": "5.859",
  "amountToNet": "834.612", "rate": "1682624", "min": "0.00047095", "max": "0.28256817", "expiresAt": null }
```

## Create

`POST /query/v1/users/:name/wallet/hive/deposit/create`

Body: `fromCoin`, `amount`, `rateType`, optional `refundAddress` + `refundExtraId` (sender wallet on the `fromCoin` network, checked with Changelly `validateAddress`), optional `destinationMemo` (Hive memo; only for exchange or swap-gateway accounts).

Order: account → coin (and fixed-rate support) → refund address → pair limits → `createTransaction` (float) or `getFixRateForAmount` + `createFixTransaction` in the same request (the rate id lives about a minute).

```json
{ "provider": "changelly", "exchangeId": "jsvcb8hqm1y6l0ar", "rateType": "float", "fromCoin": "btc", "network": "bitcoin",
  "destination": "alice", "destinationMemo": null, "payinAddress": "bc1q…", "payinExtraId": null, "payinExtraIdName": null,
  "amountExpectedFrom": "0.0005", "amountExpectedTo": "840.471", "networkFee": "5.859", "amountToNet": "834.612",
  "payTill": null, "payinNotification": null }
```

When `payinExtraId` is not null the sender must include it (memo / tag), or Changelly does not process the payment automatically. An unpaid exchange ends as `overdue` (float) or `expired` (fixed).

## Status and history

`GET /query/v1/users/:name/wallet/hive/deposit/status/:exchangeId` — Changelly `getTransactions({ id })`; 404 unless the exchange pays HIVE to `:name`.

`GET /query/v1/users/:name/wallet/hive/deposit/history?limit=20&offset=0` — Changelly `getTransactions({ payoutAddress: [name] })`, HIVE payouts only, max 100 per page. Source for a lost `exchangeId`: exchanges created with the platform Changelly key. Nothing is stored on our side.

```json
{ "exchangeId": "jsvcb8hqm1y6l0ar", "status": "finished", "rateType": "float", "fromCoin": "btc", "destination": "alice",
  "payinAddress": null, "payinExtraId": null, "payTill": null, "amountExpectedFrom": "0.0005", "amountExpectedTo": "840.471",
  "amountFrom": "0.0005", "amountTo": "834.6", "networkFee": "5.859", "payoutHash": "…", "createdAt": "2026-11-24T12:00:00.000Z" }
```

Statuses: `waiting` → `confirming` → `exchanging` → `sending` → `finished`; also `failed`, `refunded`, `hold` (AML/KYC), `overdue`, `expired`.

Privacy: these routes are unauthenticated, so `payinAddress` / `payinExtraId` are returned only while the status is `new` or `waiting`, and the pay-in hash and refund address are never returned. Amounts and timestamps stay visible.

## Errors

| Status | When |
|--------|------|
| `400` | Invalid query/body, unsupported coin, fixed rate unavailable for the coin, fixed rate without `refundAddress`, invalid refund address, amount outside limits |
| `404` | No `accounts_current` row for `:name`; status: exchange not found or not paying HIVE to `:name` |
| `503` | Changelly unavailable, missing/invalid `CHANGELLY_PRIVATE_KEY` |

## MCP

| Tool | HTTP equivalent |
|------|-----------------|
| `get_hive_deposit_currencies` | `GET /wallet/hive/deposit/currencies` |
| `get_user_hive_deposit_range` | `GET .../deposit/range` |
| `post_user_hive_deposit_estimate` | `POST .../deposit/estimate` |
| `post_user_hive_deposit_create` | `POST .../deposit/create` |
| `get_user_hive_deposit_status` | `GET .../deposit/status/:exchangeId` |
| `get_user_hive_deposit_history` | `GET .../deposit/history` |

Unlike withdraw `create`, deposit `create` is exposed via MCP: it needs no user key. Agent workflow: skill `changelly-hive-deposit-for-agents` ([Waiviogit/skills](https://github.com/Waiviogit/skills)).

## Verification

```bash
pnpm nx test clients --testPathPatterns=changelly
pnpm nx test query-api --testPathPatterns=hive-changelly-deposit
curl -s "http://localhost:3001/query/v1/wallet/hive/deposit/currencies?search=usdt" | jq .
curl -s "http://localhost:3001/query/v1/users/alice/wallet/hive/deposit/range?fromCoin=btc" | jq .
curl -s -X POST "http://localhost:3001/query/v1/users/alice/wallet/hive/deposit/estimate" \
  -H 'Content-Type: application/json' -d '{"fromCoin":"btc","amount":0.0005}' | jq .
```
