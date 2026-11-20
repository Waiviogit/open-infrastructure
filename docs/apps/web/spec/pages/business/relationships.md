---
id: web-business-relationships
title: Business — relationships & ledger
description: Counterparty list, balance cards, contract and invoice tabs.
type: spec
status: active
scope: web
tags: [web, business, relationships]
updated_at: 2026-11-19
related:
  - docs/apps/web/spec/pages/business/overview.md
  - docs/spec/obl/mutual-ledger.md
  - docs/spec/obl/service-orders.md
  - docs/spec/obl/reports.md
---

# Business — relationships & ledger

**Back:** [Business overview](overview.md)

## List (`/business/relationships`)

`GET /query/v1/obl/relationships?account=&limit=&offset=` — paginated `{ items, hasMore }`; infinite scroll on the client.

Each row is a link to the ledger: avatar, `@counterparty`, translated roles, `Contracts: N`, last activity, and the **confirmed** balance summary (`DirectionalUsd`; owed to the viewer in the success colour). A failed load shows `BusinessErrorState`, not the empty state. When confirmed net is settled (zero) but the **pending** bucket is non-zero, a second caption line shows the pending amount and direction (e.g. settled + “Pending: you owe @counterparty $10.00”).

## Detail (`/business/relationships/:account`)

- Header: breadcrumbs (Relationships › @counterparty), avatar + `@counterparty`; actions **Create invoice** (primary), **Record payment**, and a **More** menu (`BusinessActionsMenu`: create service order, create report, copy payment link).
- Balance from `GET /query/v1/obl/balance`; tab lists load from `GET /query/v1/obl/ledger/{payments|contracts|service-orders|reports|invoices|disputes}` with cursor pagination and infinite scroll (only the active tab is fetched initially; other tabs lazy-load on first visit).
- Tabs (default **Payments**): Payments, Contracts, Service orders, Reports, Invoices, Disputes — no Overview tab. `BusinessSubTabs` (underlined, scrolls on mobile, `replace` navigation). The first load of a tab shows a card skeleton, never the empty state; each empty tab explains itself and offers its action (Record payment, Create service order / report / invoice). Pages returned by a server refresh are merged into the loaded tabs instead of resetting them.
- Tab selection is URL-synced via `?tab=payments|contracts|service-orders|reports|invoices|disputes` (default omits query). Example: `/business/relationships/flowmaster?tab=service-orders`.
- All tab lists are ordered **newest first** by `created_at` (API + client sort).
- Balance cards show every bucket with a direction ("@alice owes you $2,101.00" / "You owe @alice …"); amounts go through `formatUsd` (`$1,234,567.89`, `−` for negatives).
- Header actions open modals (no inline forms on tabs). Every modal is a `BusinessFormModal`: it closes only when the broadcast returned a transaction id; a failure keeps the input and shows `BusinessActionError` above the footer; Escape, backdrop and Cancel are disabled while the broadcast is in flight. Amount fields start empty (no prefilled `5` / `10`).
  - **Create invoice** — `BusinessIssueInvoiceModal`: issuer fixed to viewer; optional governing `contract_id`; optional service order and report as selects (active service orders and reports of the pair, narrowed to the chosen contract); **Simple** / **Split payment** modes (see existing split/attestor rules); optional supporting info via **Object Builder** (`details`).
  - **Create service order** — `BusinessCreateServiceOrderModal`: contract dropdown (signed pair contracts whose **offer is `active`**; retired offers omitted), optional `details` via **Object Builder** (prefill from contract `service_order_schema` when present); `service_order_create`. On submit `compactServiceOrderDetails` drops fields left blank (`''`, whitespace, `null`, empty arrays and objects, recursively; `false` and `0` stay), so untouched optional schema fields never reach the chain; all blank → no `details`.
  - **Create report** — `BusinessCreateReportModal`: optional contract and/or service order (selects; only active service orders; at least one link required on chain), optional `details` via **Object Builder**; `report_create`.
  - **Record payment** — `BusinessDeclarePaymentModal` (unchanged).
  - **Copy payment link** — copies `/business/pay?for=<viewer>&to=<counterparty>` so another account can pay on the viewer's behalf.
- **Pay on behalf** page `/business/pay?for=&to=` (`BusinessPayOnBehalfClient`): editable debtor/receiver prefilled from the query, USD amount, **Pay with WAIV** (Hive Engine transfer with memo `obl:on-behalf:<debtor>`, USD→WAIV via `/api/business/convert-usd-to-waiv`) and **Declare off-chain payment** (`payment_declare` with `payer = debtor`, signed by viewer). Client mirrors indexer rules (`validatePayOnBehalfParties`) and warns, without blocking, when the debtor has no confirmed debt. The debt shown there is the confirmed **net** from `netUsd` (`confirmedDebtUsd` → `accountNetUsd`, the same reader as the balance cards), never the gross `owesAtoB` / `owesBtoA`, which ignore credits and invoices issued the other way. See [payment on behalf](../../../../spec/obl/payment-on-behalf.md).
- Payments rows show **Paid by @account** when `paid_by` is set.
- **Confirm payment**, **Payments tab**, **Dispute invoice** — unchanged (see prior spec text in git history if needed).
- Cards (`relationship/ledger-cards.tsx`) lead with a human title (offer name, invoice memo / title, report summary) and show ids only as `CopyableId`; amounts on the right (`formatUsd`, settled invoices show the original struck through).
- **Contracts tab** — offer label (`Name · vN`), parties, description (truncated to 300 chars), retired badge; link to contract detail.
- **Service orders tab** — cards link to `/business/service-orders/:id`; contract label when known; destructive **Cancel** button (not nested in the link) when the SO is `active` and the viewer is provider or client — it opens a confirmation dialog before `service_order_cancel`.
- **Reports tab** — cards link to `/business/reports/:id`; author, contract, optional service order label.
- **Invoices tab** — title links to invoice detail; `@debtor pays @creditor`, linked contract, state badge, **Dispute** button when allowed.
- **Payments tab** — Market cards like the other tabs: `Transferred to @x` / `Received from @x` (one translated sentence per direction, `{account}` placeholder), status, method, time, **Paid by**, reference note; amount on the right from `buildLedgerPaymentAmountView`: `−$100.00` sent, `+$100.00` received (`formatUsd`, sub-cent curation rewards keep two significant digits), plus **Declared amount** when the confirmed amount differs. A payment awaiting the viewer shows an explicit **Confirm received payment** button (the row itself is not a button).
- **Disputes tab** — unchanged.

## Entity pages (contract, invoice, service order, report, dispute)

Shared layout (`ledger-detail-parts.tsx`): breadcrumbs Relationships › @counterparty › entity (no pair link when the viewer is not a party), a human title, cards **Amount** / **Parties** (avatar links to each relationship) / **Linked records** / details as label–value pairs (never raw JSON), and a collapsed **Technical details** card with ids (`CopyableId`), transaction id and the absolute creation time.

## Invoice (`/business/invoices/:invoiceId`)

`GET /query/v1/obl/invoices/:invoiceId` — parties, amounts, state, optional contract summary, optional linked service order and report, relationship links.

## Service order (`/business/service-orders/:serviceOrderId`)

`GET /query/v1/obl/service-orders/:serviceOrderId` — parties, contract, `details`, `status`, `cancelled_by` / `cancelled_at` when cancelled, relationship links. Viewer who is a party can **Cancel** an active SO after a confirmation dialog (`service_order_cancel`; signer is posting auth, not a payload field).

## Report (`/business/reports/:reportId`)

`GET /query/v1/obl/reports/:reportId` — author, contract, optional service order, `details`, relationship links.

## Dispute (`/business/disputes/:disputeId`)

`GET /query/v1/obl/disputes/:disputeId` — status, settlement summary, links to invoice and contract.

## Contract (`/business/contracts/:contractId`)

`GET /query/v1/obl/contracts/:contractId` — offer name/description when present, offer link, contract id, provider/client, dispute rule, arbiter (when set), created_at, transaction id, metadata.
