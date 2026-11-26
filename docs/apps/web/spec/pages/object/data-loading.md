---
id: web-pages-object-data-loading
title: Object page — data loading
description: Server-side fetch, caching and streaming order for `/object/[object-id]` — head first, full model behind it.
type: spec
status: active
scope: web
tags: [web, page, object, data-loading]
updated_at: 2026-11-26
related:
  - docs/apps/web/spec/pages/object/page-shell.md
  - docs/apps/web/spec/seo.md
  - docs/apps/web/spec/caching.md
  - docs/apps/query-api/spec/object-head.md
---

# Object page — data loading

**Back:** [page-shell](page-shell.md) · [web overview](../../overview.md)

## Purpose

Server-side fetch, caching and streaming order for `/object/[object-id]`. The hero (name, avatar, cover, type, status) paints from a cheap head; menus, rails and the center column stream in after the full model.

## Order

| Stage | Where | Shows |
|-------|-------|-------|
| App Shell | `object/loading.tsx` (prefetched by every object link) | Generic object skeleton (same hero geometry) |
| Head | `[object-id]/layout.tsx` awaits `params`, locale, `loadObjectHead` | `ObjectHeadShell`: the real `ObjectHero` (`pending`, controls inert) + tab, rail and center skeletons |
| Full | `ObjectPageFullSection` inside `<Suspense fallback={<ObjectHeadShell/>}>` | Viewer, `loadObjectPageModel`, `notFound()`, JSON-LD, `ObjectPageShellClient`, rails |
| Tab body | `page.tsx` inside its own `<Suspense>` | Tab data (`[object-id]/loading.tsx` on tab switches) |

`ObjectPageFullSection`, `ObjectDetailPageContent` and `generateMetadata` start with `await navigation()` (`next/cache`): a link prefetch (`prefetch={true}` on hover / focus / touch, see [caching.md](../../caching.md#instant-navigation)) renders only up to the head, never the full resolve. On a full page load `navigation()` resolves at once.

A failed head read never decides 404: the head shell falls back to the generic skeleton and existence is decided by the full model (`notFound()` streams the not-found UI with `noindex`).

## Loaders

| Loader | File | Upstream |
|--------|------|----------|
| `loadObjectHead` | [`object-page-model.server.ts`](../../../../../apps/web/src/app/(app)/object/[object-id]/object-page-model.server.ts) | `fetchObjectHead` → `GET /query/v1/objects/:id/head` ([spec](../../../../apps/query-api/spec/object-head.md)) |
| `loadObjectPageModel` | same file | `fetchProjectedObjectWithCounts` + `fetchObjectOptions` → query-api |

Both are wrapped in **`react.cache()`**. Layout, page body and `generateMetadata` pass the same viewer, so `loadObjectPageModel` runs once per request.

`loadObjectHead` sends no viewer and no client IP: one `'use cache'` entry per object and locale for every visitor (tag `queryApiCacheTags.objectHead`, expired by `revalidateObjectAfterBroadcast`).

`fetchObjectOptions` loads aggregated variant options (`GET /query/v1/objects/:id/options`) in parallel with resolve. Results map to the left-rail `options` block (Color/Size selectors) when non-empty; edit mode shows the `+` slot when the object type supports `option`.

### Resolve options

- **`locale`** — `getRequestLocale()` → `X-Locale` on query-api
- **`viewer`** — cookie auth username or `null` → `X-Viewer`
- **`includeSeo: true`** for metadata path — see [seo.md](../../seo.md)

### Query API visibility

Object page resolve (`POST /query/v1/objects/resolve`) and head load **any** page-visible `objects_core.status`. Search, discover, favorites, and nested/ref cards of other objects still restrict to `status = 'active'`. Non-active objects show a lifecycle badge in the hero when `status !== 'active'`. For **`closed`** venue types (`business`, `restaurant`, `place`, `shop`), the hero label and left-rail notice (“Permanently closed”, body copy, “Suggest a correction”) link to `/object/:id/updates?update_type=status`.

## Fallback

- Demo objects: `DEMO_OBJECT_IDS` → `mockModelFromDemoPreset` when API returns null
- Missing object → `notFound()` in `ObjectPageFullSection` and `page.tsx`

## Additional SSR payloads (same request)

| Data | When | Source |
|------|------|--------|
| Right rail ref previews | View mode rail | `ObjectPageRightRailSection` (own `<Suspense>` in the full section): related/similar/add-on, field references |
| Followers / experts preview | `followers_count > 0` / `experts_count > 0` | same section (limit 6) |
| Mobile social preview | Types with a Details tab | `ObjectPageMobileSocialSection` |
| Updates feed initial page | Active tab `updates` | `ObjectPageUpdatesFeedSection` |
| Ownership lists | Tab `ownership` | `getObjectOwnershipPageQuery` |
| Ref list full page | Tab related/similar/add-on | `fetchObjectRefList` page size 20 |
| Related album preview | Active tab `gallery` (SSR) or client on gallery tab | `fetchObjectRelatedAlbumPreview` |
| Related album list page | `gallery_album=Related` (SSR) or client in `ObjectRelatedAlbumSection` | `fetchObjectRelatedAlbumPage` |
| Nested stack | `?path=` | `resolveNestedObjectPath` / per-item resolve |

## Mapping

- `projectedObjectToHeroIdentity` → `ObjectHeroIdentity` (hero fields). Called for the head and inside the full mapper, so both paint the same hero.
- `projectedObjectWithCountsToPageModel` → `ObjectPageViewModel` (tabs, default landing, left rail blocks, embedded updates feed options).

Both live in `@/modules/object/infrastructure/projected-object-to-page-model.ts`.

`ObjectThumbnail` and `ObjectHeroCoverImage` remember per URL which fallback (raw → proxy → preview) worked, so the hero that remounts when the full page replaces the head shell does not retry a broken source.

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns="projected-object-to\|object-head-shell\|object-hero"` | Mapping, hero parity, head shell |
| `pnpm nx test web --testPathPatterns=object-options-section` | Options UI helpers |
| `node .claude/skills/verify/scripts/nav-instant-trace.cjs feed/updates 'main li > a[href^="/object/"]' --rtt 150 --hover 200` | Hero in the first frames after a hovered click (production build) |
| Manual | View source — title from `model.seo`; hero counts match resolve |

## Related code paths

| Path | Role |
|------|------|
| `apps/web/src/app/(app)/object/[object-id]/layout.tsx` | Head stage + Suspense boundary |
| `apps/web/src/app/(app)/object/[object-id]/object-page-full-section.server.tsx` | Full stage |
| `apps/web/src/modules/object/infrastructure/fetch-object-head.server.ts` | HTTP head |
| `apps/web/src/modules/object/infrastructure/fetch-object-resolve.server.ts` | HTTP resolve |
| `apps/web/src/modules/object/infrastructure/fetch-object-options.server.ts` | HTTP variant options |
| `apps/web/src/modules/object/presentation/components/object-head-shell.tsx` | Hero from the head + skeletons |
| `apps/web/src/modules/object/presentation/components/object-options-section.tsx` | Color/Size selector UI |
| `apps/web/src/seo/application/build-object-metadata.ts` | Metadata from `model.seo` |
