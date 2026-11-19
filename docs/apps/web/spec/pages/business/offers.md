---
id: web-business-offers
title: Business — offers & requests
description: Draft editor, publish/retire, and discover catalog routes.
type: spec
status: active
scope: web
tags: [web, business, offers]
updated_at: 2026-11-19
related:
  - docs/apps/web/spec/pages/business/overview.md
---

# Business — offers & requests

**Back:** [Business overview](overview.md)

## Discover catalog

- `/business/offers` (default) and `/business/requests` — public `searchOblOffers` lists with `?author=` and `?q=`. Page title is the hub label (**Market**, `app_section_nav_business`).
- Each row is an `OfferCard` (whole card is the link): author avatar + `@author`, title (2 lines), price from `terms` (`parseOfferCommercialSummary`: fixed / hourly / price on request), billing cycle, description excerpt (`markdownToPlainText`), up to 3 tags + `+N`. No status badge: the catalog only lists active versions.
- States: query-api failure → `BusinessErrorState` with **Try again** (`router.refresh()`); empty catalog → empty state with **Create offer/request** (opens the login dialog for guests); no matches → empty state with **Clear filters**.
- Guests: `BusinessGuestCard` (what signing in unlocks + **Sign in**) under the rail filters on desktop and above the list below `lg`. The page passes `signedIn` from `getRequestUser()` inside its Suspense body.
- Public version pages get `buildOfferMetadata` ([SEO](../../seo.md)): offer name, description excerpt, canonical.
- `/business` redirects to `/business/offers`.
- Tab band **Catalog**; the rail holds the Offers / Requests switch (URL paths, browser history) and the filters (search + author, Enter submits). Applied filters show as removable chips above the list; on mobile the filters open in the shared filter sheet.
- `/offers` and `/requests` redirect to discover.

## Draft editor (`/business/manage/offers/drafts/:draftId` or `/business/manage/requests/drafts/:draftId`)

- Nine steps (`OFFER_EDITOR_STEPS` in `offer-form.types.ts`); debounced PATCH autosave (~800ms). The save status reads the action `Result`: saving → saved, or **Couldn't save** with **Try again** (a failed PATCH never shows "Saved"; publish stops when the last save failed).
- All steps have real fields: basics (incl. tags), service (`service_ref` + optional `terms.signParams`), **schema** (optional `terms.serviceOrderSchema` via hybrid JSON Schema builder), commercial (`terms`), billing, termination (`terms.termination`), disputes, legal (`legal_ref` + off-chain `legalText`).
- Layout: breadcrumbs (My offers › Drafts › name), steps in the context rail (`EditorStepNav`: ✓ complete, ! needs attention, number otherwise; `aria-current="step"`, status also in screen-reader text). Below `lg` the steps open from a `Step N of 9 · <step> ▾` drawer trigger with a progress bar; Back / Continue stick to the bottom of the viewport.
- **Full preview:** header button opens a scrollable modal; **Open in new tab** → `.../drafts/:draftId/preview`. Both render `OfferFullPreview`: the public offer page's header and `OfferTermsSummary` (translated pricing, termination and dispute rule), the sign parameters the counterparty will fill, then the editor-only notes (billing notes, draft notes). The preview page uses the public page's two columns (content | sign panel), breadcrumbs (My offers › Drafts › name › Full preview) and a **Back to editor** button, which is the only back link below `sm`.
- Row editors (sign parameters, service order schema, `ObjectBuilder` custom properties) use `BusinessButton`: **Add …** is secondary with a plus icon, **Remove** is `quiet` with a trash icon. `ObjectBuilder` lays out key | type | remove with the value below, so it fits narrow modals and the sign panel at any viewport width; every control has an accessible name.
- Review step: readiness checklist as one bordered list; each step shows a coloured dot plus a text status (Ready / Optional / Needs attention) and **Fix** for blocked steps. **Publish version** is the primary button with a busy state; a failed broadcast shows `BusinessActionError`.
- Publish validation via `offer-draft.schema.ts` (Zod); review step shows readiness checklist; publish blocked until `name` (+ arbiter when required).
- New version flow: clone sets `publishedOfferId` → publish uses `offer_update`; first publish uses `offer_publish`.
- Disclosures on legal step: `legal_ref` not versioned, immutable published versions.

## Private lists (`/business/manage/...`)

- `/business/manage/offers/drafts` | `published` | `retired` — offers only (`kind=offer`)
- `/business/manage/requests/drafts` | `published` | `retired` — requests only (`kind=request`)

Published / retired tabs call `searchOblOffers` with `author`, `kind` and `status` (`active` | `retired`). The obl-drafts API has no kind filter, so the drafts tab filters on the client and keeps paging (sentinel stays mounted) until rows of this kind appear or the list ends. A failed load shows `BusinessErrorState`, not the empty state.

- Tab band: **My offers** and **My requests** (management, not discover).
- Rail: **Drafts** | **Published** | **Retired** — each has its own URL (drawer `Drafts ▾` on mobile).
- **Create new offer** / **Create new request** in page header actions.
- `/business/manage/offers/new` and `/business/manage/requests/new` create drafts with fixed kind; editor basics step shows kind as read-only.
- Legacy `/business/offers/*` and `/business/requests/*` manage paths redirect to `/business/manage/...`.

## Offer detail (`/business/manage/offers/:offerId`)

Breadcrumbs (My offers › Published / Retired › name), terms summary (`OfferTermsSummary`), **Retire** (`buildRetireOfferOp`) behind a destructive confirmation (`BusinessConfirmDialog`; the dialog stays open with the error if the broadcast fails), **New version** (clone fields into a new draft; button is busy while the draft is created). Links to the public page and to the version page.

## Public sign

- `/offers/:id/versions/:v`, `/requests/:id/versions/:v` — unchanged.
- Layout: back link to Market, header card (kind, version, status, title, author with avatar, price, description, tags), **Terms** card (`OfferTermsSummary`: price, billing cycle, termination who / mode / notice, dispute rule + arbiter, service and legal document links), then the sign panel (sticky right column on desktop, below the terms on mobile).
- Sign panel by viewer: guest → **Sign in to sign** (opens the login modal); author → link to manage; retired version → notice; already signed → link to the relationship.
- Sign page — mandatory ledger + auto-payment disclosures before `buildSignContractOp`. If viewer already signed this offer with the author, sign form is hidden. Counterparty supplies `metadata` via guided fields when `terms.signParams` is set, else optional **Object Builder** custom properties (`ObjectBuilder` in `public-offer-page-client.tsx`).
