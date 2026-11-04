---
id: obl-payments
title: OBL payments
description: Token transfers, upvote rewards, off-chain declare/confirm — all USD netting.
type: spec
status: active
scope: platform
tags: [obl, payments]
updated_at: 2026-11-04
related:
  - docs/spec/open-business-layer.md
  - docs/spec/obl/mutual-ledger.md
  - docs/spec/obl/payment-on-behalf.md
---

# Payments

All netting in **USD**. On-chain rows store `token_symbol`, `token_amount`, `rate_usd` for audit.

Payments are **not** linked to a contract or an invoice (`obl_payments` has no `contract_id`). Contract context lives on invoices only. Netting is always per `payer`↔`receiver` pair.

A third account may pay on behalf of the debtor; the row stays on the debtor↔receiver pair and records the actual payer in `paid_by` — see [payment on behalf](payment-on-behalf.md).

Each payment row has `created_at` (Hive block timestamp at index time, stored as UTC `timestamptz`).

Block timestamps from Hive omit a `Z` suffix; the indexer normalizes them to UTC via `hiveBlockTimestampToDate` so `created_at` is independent of the host timezone.

## On-chain (auto `confirmed`)

| Method | Source |
|--------|--------|
| `token_transfer` | Hive Engine `tokens/transfer` (WAIV MVP) |
| `upvote_reward` | `comments` `curationReward` — voter pays post author |

USD rate: WAIV → `hive_engine_rates`; other symbols → `hive_engine_swap_pool_usd`.

Pair-match ledger required; cutoff after ledger start. A WAIV transfer with memo `obl:on-behalf:<debtor>` is matched to the debtor↔receiver ledger instead ([payment on behalf](payment-on-behalf.md)).

## Off-chain

| Action | Signer | State |
|--------|--------|-------|
| `payment_declare` | payer, or a third account [on behalf](payment-on-behalf.md) of the payer | `pending` |
| `payment_confirm` | receiver | `confirmed` |

Receiver-only confirm (no prior declare) allowed.

Client-generated `payment_id` values use prefixed UUIDs (`pay-{uuid}` for declare, `pay-recv-{uuid}` for confirm).

## `declared_amount_usd`

Each payment row stores both:

| Column | Role |
|--------|------|
| `declared_amount_usd` | Amount originally declared on this row |
| `amount_usd` | Settled amount used for balance netting |

- `payment_declare` sets both to the declared value.
- `payment_confirm` against a declare updates only `amount_usd` on that row to the confirmed amount (may be less than, equal to, or greater than declared); `declared_amount_usd` stays at the original declare. No additional payment rows are created.
- Receiver-only confirm (no prior declare) sets `declared_amount_usd` equal to `amount_usd` on insert.
- On-chain auto payments (`token_transfer`, `upvote_reward`) set both equal at insert.

Balance buckets use **`amount_usd` only**. Web relationship UI shows declared (neutral/black) + confirmed (signed/colored) when the two differ.

## `ref` JSONB

Optional metadata on `obl_payments.ref`:

| Source | Shape | Purpose |
|--------|-------|---------|
| `payment_declare` | user JSON (`note`, `memo`, `report`, …) | Off-chain payment context (bank transfer note, tx id, etc.) |
| `payment_confirm` (receiver-only) | `{ receiver_only_confirm: true }` | Confirm without a prior declare |
| `upvote_reward` indexer | `{ authorperm: "@author/permlink" }` | Link curation reward to the post that earned it |
| `token_transfer` indexer | `{ he_tx }` or `{ he_tx, on_behalf_of }` | Hive Engine tx; debtor named in an on-behalf memo |

Web relationship UI shows user `note`/`memo`/`report` and renders `upvote_reward` `authorperm` as a post link; system confirm tags are hidden.

Legacy rows may still exist with `{ partial_remainder_of }` or `{ excess_confirm }` from older indexer behavior; new confirms do not create those rows.

## USD → WAIV utility

`GET /query/v1/obl/convert/usd-to-waiv?amountUsd=` — live read via stored `hive_engine_rates`.
