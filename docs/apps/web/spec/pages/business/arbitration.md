---
id: web-business-arbitration
title: Business arbitration inbox
description: Arbiter dispute queue under /business/arbitration.
type: spec
status: active
scope: web
tags: [web, business, obl, disputes]
updated_at: 2026-11-19
related:
  - docs/apps/web/spec/pages/business/overview.md
  - docs/spec/obl/disputes.md
  - docs/apps/query-api/spec/obl.md
---

# Arbitration inbox

**Back:** [business overview](overview.md)

## Route

| Route | Role |
|-------|------|
| `/business/arbitration` | Open disputes assigned to viewer as `contract.arbiter` (default filter) |
| `/business/arbitration?status=resolved` | Resolved dispute history |

Nav item **Arbitration** is always visible in the Business shell (after Relationships).

## UX

- Status tabs: **Open** / **Resolved** (`BusinessSubTabs`, underlined, optimistic; `arbitration-status-url.ts`, URL-synced).
- Infinite scroll via `useSyncedPaginatedList` + `loadMoreOblArbitrationAction`.
- Each card (`DisputeInboxCard`, shared with dispute resolution): offer name (link to the dispute), status badge, `@provider and @client`, `DisputeSettlementSummary`, **View dispute** (the arbiter is not a party, so there is no relationship link).
- Open cards: **Resolve dispute** opens shared `BusinessResolveDisputeModal` (`dispute_resolve` broadcast). For multi-beneficiary invoices **Reject all** needs a second, destructive confirmation. Failures stay in the modal; the indexing badge shows while waiting for confirmation.
- A failed load shows `BusinessErrorState`, not the empty state.
- Empty copy: “No disputes assigned to you”.

## Data

- Initial page: `fetchOblArbitration` in RSC (`obl-arbitration.server.ts`).
- Cache tag: `queryApiCacheTags.oblArbitration(account, status)`.
- After arbiter resolve: `revalidateOblAfterBroadcast` with `refreshArbitration` and `ledgerPairs` for provider/client.

## Files

| Piece | Path |
|-------|------|
| Page | `apps/web/src/app/(app)/business/arbitration/page.tsx` |
| Loading | `apps/web/src/app/(app)/business/arbitration/loading.tsx` |
| Client | `business-arbitration-client.tsx` |
| Skeleton | `skeletons/business-arbitration-skeleton.tsx` |
