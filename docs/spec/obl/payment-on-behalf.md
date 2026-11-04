---
id: obl-payment-on-behalf
title: OBL payment on behalf of debtor
description: A third account pays a debtor's debt to a receiver; counted on the existing debtor↔receiver ledger.
type: spec
status: active
scope: platform
tags: [obl, payments]
updated_at: 2026-11-04
related:
  - docs/spec/obl/payments.md
  - docs/spec/obl/mutual-ledger.md
  - docs/apps/chain-indexer/spec/obl-parser.md
---

# Payment on behalf of debtor

**Related:** [Payments](payments.md) · [Mutual ledger](mutual-ledger.md)

Account **C** pays **B** for **A** (A is the debtor). The payment names only the pair and the direction: *for whom* (A) and *to whom* (B). It is not linked to an invoice.

## Model

The row in `obl_payments` is written with `payer = A`, `receiver = B` and `paid_by = C`. Netting, ledger cutoff and `/obl/balance` are unchanged because the pair is still A↔B.

| Column | Meaning |
|--------|---------|
| `payer` | Debtor whose debt is paid |
| `receiver` | Account that receives the payment |
| `paid_by` | Account that actually paid; `null` when the debtor paid itself |

- No ledger involving C is created, and A owes nothing to C.
- The amount counts in full, without a cap at the outstanding debt (same as any payment).

## Rules (both channels)

Input: actor C, debtor A, receiver B, event seq. The payment counts only if:

1. A, B and C are non-empty, `A ≠ B` and `C ≠ B` (the receiver cannot pay on behalf of the debtor);
2. the A↔B ledger exists and the event is at or after its start (`findLedgerStartedSeq`).

When `C = A` it is a regular payment and `paid_by` is `null`. Implementation: `OblOnBehalfPayerResolver` in `apps/chain-indexer/src/domain/obl-parser/`.

## WAIV transfer

A Hive Engine `tokens/transfer` of WAIV from C to B whose memo is:

```
obl:on-behalf:<debtor>
```

Helpers: `buildOblOnBehalfMemo` / `parseOblOnBehalfMemo` (`@opden-data-layer/core/utils/obl-on-behalf-memo`). The parser trims whitespace, matches the prefix case-sensitively and requires a valid Hive account name.

- Valid memo and rules pass: row `payer = A`, `paid_by = C`, `state = confirmed`, `ref = { he_tx, on_behalf_of }`.
- Valid memo but rules fail (e.g. no A↔B ledger): the transfer is **skipped**. It does not fall back to the C↔B pair, because the sender stated its intent.
- No memo or not an on-behalf memo: previous behavior (C↔B pair).
- `payment_id` stays `obl:he-transfer:{tx}:{log}`, so reindexing is idempotent.
- No notification is emitted for on-chain transfers (same as before).

## Off-chain declare

`payment_declare` keeps its payload: `payer` = A, `receiver` = B. The signer may be C. The handler applies the rules above and stores `paid_by = ctx.creator` when the signer is not the payer. B confirms with the usual `payment_confirm`.

## Notifications

`obl_payment_declare` / `obl_payment_confirm` carry optional `paidBy`. When set, recipients are the debtor, the receiver and `paidBy`; the message key is `notification_obl_payment_{declare|confirm}_on_behalf`. See [notifications](notifications.md).

## Web

Page `/business/pay?for=<debtor>&to=<receiver>`: **Pay with WAIV** (transfer with the memo, USD converted via `/api/business/convert-usd-to-waiv`) or **Declare off-chain payment**. The relationship page has **Copy payment link**, which builds this URL for the viewer as debtor. Payment rows show **Paid by @C**. See [relationships page](../../apps/web/spec/pages/business/relationships.md).
