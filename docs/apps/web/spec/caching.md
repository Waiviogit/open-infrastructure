---
id: web-caching
title: web — caching and instant navigation (Cache Components)
description: cacheComponents in apps/web — how query-api reads are cached, how routes get an instant shell, and how routes are adopted.
type: spec
status: active
scope: web
tags: [web, caching, cache-components, prefetch, navigation]
updated_at: 2026-11-06
related:
  - apps/web/AGENTS.md
  - docs/apps/web/spec/scroll-restoration.md
  - docs/apps/web/spec/routing-proxy.md
---

# web — caching and instant navigation

**Back:** [web overview](overview.md) · **Rules:** [`apps/web/AGENTS.md` → Caching](../../../../apps/web/AGENTS.md)

`apps/web/next.config.js` sets `cacheComponents: true`. Request-time data streams behind
`<Suspense>`; caching is explicit (`'use cache'`). Framework docs: `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`, `instant-navigation.md`.

## query-api reads

`modules/user-profile/infrastructure/clients/query-api.client.ts` is the single caching point;
callers did not change.

| Call | Behaviour |
|------|-----------|
| `queryApiFetch` / `queryApiFetchOutcome` (default) | `'use cache'` function `cachedQueryApiRequest`: key = URL, method, normalized headers (lower-case, sorted), string body. `cacheLife({ stale: 30, revalidate: 60, expire: 3600 })` — stale-while-revalidate like the former fetch Data Cache. `cacheTags` → `cacheTag`. |
| `next: { revalidate: N }` (sitemap only) | Same, with `revalidate: N`. |
| Failure (network, non-OK, bad JSON) | Cached for ≤ 2 s (`revalidate: 1, expire: 2`), so outages are not pinned. |
| `QUERY_API_LIVE_INIT`, `queryApiFetchLive`, non-string body | Plain `fetch`, no cache. |
| `forwardClientIp: true` | `headers()` read outside the cache; `X-Forwarded-For` joins the request (and the key). |

Viewer (`X-Viewer`), locale (`Accept-Language`) and POST bodies are already in the request, so
per-viewer data never crosses users. Invalidation is unchanged: `updateTag(queryApiCacheTags…)` in
`shared/infrastructure/query/revalidate-after-broadcast.server.ts` expires `cacheTag` entries.

Storage: `'use cache'` lives in the server instance's memory (the old fetch Data Cache was on disk
under `.next/cache`). With several web instances each keeps its own copy; add `cacheHandlers` if
that matters.

## Instant navigation

A client navigation re-renders only below the layout both routes share. Next prefetches each
segment's **static shell** (production only) and paints it on click; whatever reads request data
streams in behind `<Suspense>`. Two conditions, both required:

1. **The route has a shell.** A layout or page that awaits `params`, cookies or data at its top has
   none, so the click waits for the server. The boundary must sit inside the segment that changes:
   a `loading.tsx` of a segment shared by both routes (e.g. `feed/loading.tsx` for feed tabs) does
   not trigger.
2. **The link prefetches it.** `prefetch={false}` (our `OptimisticNavLink` default) or
   hover-only prefetch means the shell is fetched on click — one round trip (two requests do not
   finish between hover and click at real latency).
   `OptimisticNavLink prefetchShell` prefetches the shell while the link is visible; use it for
   small fixed menus.

| Entry | Shell painted on click | Where | Link |
|-------|------------------------|-------|------|
| `/@name` (profile) | profile skeleton | `user-profile/[name]/layout.tsx` — existence check (`ValidatedProfile`) inside `<Suspense fallback={<UserProfileNameLoading/>}>` | Story author `<Link>` (default prefetch) |
| `/`, `/feed/{threads,activity,updates}` | `<main>` + feed skeleton | each page renders `<Suspense fallback={<FeedPostsLoadingSkeleton/>}>` around the user/data read | `HomeFeedMenu` → `OptimisticNavLink prefetchShell` |
| `/object/:id` | object skeleton | `object/loading.tsx` sits above the blocking `[object-id]` layout | `ObjectPageLink` (default prefetch; 2 small requests per visible distinct object until Partial Prefetching) |
| `/object/:id/<tab>` (tab buttons) | center skeleton overlay, then the tab chrome | `ObjectPageShellClient` overlays `ObjectPageCenterSkeleton` while `navigateInstant` is pending; `page.tsx` renders its body inside `<Suspense fallback={<ObjectDetailLoading/>}>` so the tab chrome streams before its data | buttons, no prefetch needed (the overlay is client-side) |

The root layout stays blocking on purpose (`<html>` lang/dir/theme/shell-mode from cookies): it is
shared by every client navigation, so it only affects full page loads.

### Not found

An existence check inside `<Suspense>` runs after the shell is sent: `notFound()` streams the
not-found UI with `noindex` and HTTP 200. Malformed URLs get a real 404 earlier, in `proxy.ts`
(`isProfileAccountSegment` → rewrite to `/_not-found` with status 404).

## Adoption status

`npx @next/codemod cache-components-instant-false` put `export const instant = false` on every
page/layout/default. Each one not yet adopted carries the marker:

```bash
rg -l "@next-codemod-ignore Cache Components adoption" apps/web/src/app
```

A route is adopted when its marker is gone, `next build` passes, the dev overlay is clean and
`nav-instant-trace.cjs` (verify skill) shows the skeleton in the first frames after the click.
A deliberate Block keeps `instant = false` with a reason comment (root layout).

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns=clients/query-api` | Cache routing, tags, lifetimes, IP in key |
| `pnpm nx run web:verify-production-build` | Build passes with `cacheComponents` |
| `node .claude/skills/verify/scripts/nav-instant-trace.cjs feed/threads 'main a[href="/@alice"]' --skeleton '[aria-label="Loading profile"]'` | Profile skeleton before the round trip |
| `pnpm test:db:up && pnpm nx run web-e2e:e2e-instant` | Production `instant()` suite: shells under the navigation lock ([rig](../../../../apps/web-e2e/instant-nav.rig.md)) |
