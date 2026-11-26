---
id: web-pages-user-profile-data-loading
title: User profile — data loading
description: This document covers loading **shell profile** data (hero / header counts and display fields). Feed tabs and post lists are out of scope here — see routes/feed.md.
type: spec
status: active
scope: web
tags: [web, page, user-profile, data-loading]
updated_at: 2026-11-26
related:
  - docs/apps/web/spec/overview.md
  - docs/apps/web/spec/pages/user-profile/profile-shell.md
  - docs/apps/web/spec/pages/index.md
---

# User profile — data loading

**Back:** [profile-shell.md](profile-shell.md) · [web overview](../../overview.md)

## Scope

This document covers loading **shell profile** data (hero / header counts and display fields). Feed tabs and post lists are out of scope here — see [routes/feed.md](routes/feed.md). The **activity** tab uses Hive account history via [`routes/activity.md`](routes/activity.md), not the blog `Story` feed.

## When data loads

| Stage | Location | What |
|-------|----------|------|
| Entry skeleton | `[name]/loading.tsx` (prefetched by every profile link) | `ProfileHeroSkeleton` (same geometry as `UserHero`) + rail and feed skeletons |
| Existence | `[name]/layout.tsx` (`ValidatedProfile`, inside `<Suspense>`) | `getUserHeadQuery` → `GET /users/:name/head` ([spec](../../../../apps/query-api/spec/user-head.md)); `notFound()` only on a definite 404 — an unavailable query-api renders on, so a failed read cached into a prefetch never becomes "not found" |
| Head | `(profile)/layout.tsx` | the same head (React `cache`) → `ProfileHeadShell`: the real hero in `pending` mode (no follow / bell / edit / guest controls, reputation placeholder), the real primary tabs, rail and feed skeletons |
| Full | `(profile)/profile-group-full.server.tsx` behind the head shell | `await navigation()`, viewer, `getUserProfileQuery(name, viewer)`, following-objects count (`limit=0`, no viewer / locale), expertise counters, owner unread counts; the account sidebar is passed to the hero as a promise |
| Tab body | `(main)/page.tsx` etc. | `await navigation()` first; `generateMetadata` too |

`navigation()` keeps the viewer read and the full profile out of link prefetches: `ProfilePageLink` (and header search user rows) switch to `prefetch={true}` on intent, and the per-link prefetch carries only the head — see [caching.md](../../caching.md#partial-prefetching).

The hero never waits for the account sidebar (live Hive / Engine reads): reputation and the mobile meta read the promise with `use()` behind their own placeholders (`UserHeader` → `SidebarPart`).

`/profile` is requested with the viewer only — query-api does not read the locale, so it is not part of the cache key.

| Location | When |
|----------|------|
| `apps/web/src/app/(app)/user-profile/[name]/(profile)/(main)/@leftSidebar/*` | `getUserAccountSidebarQuery` on default routes (not favorites — see [routes/favorites.md](routes/favorites.md)) |

### Left sidebar (account panel)

| Route slot | Query | API |
|------------|-------|-----|
| `@leftSidebar/page.tsx`, `[...slug]/page.tsx`, `default.tsx` | `getUserAccountSidebarQuery` | `GET /query/v1/users/:name/account-sidebar` |

Spec: [components/account-sidebar.md](components/account-sidebar.md). Cache tag: `userAccountSidebar:{name}`.

### Expertise tab SSR

| Route | Query layer | API |
|-------|-------------|-----|
| `.../expertise-hashtags`, `.../expertise-objects` | `getExpertiseObjectsPageQuery` | `GET /query/v1/users/:name/expertise/objects?scope=` |
| Profile layout (badge counts) | `getExpertiseCountersQuery` | `GET /query/v1/users/:name/expertise/counters` |

Expertise object lists send `X-Locale` / `Accept-Language` for field projection. Cache tags: `userExpertiseCounters`, `userExpertise`.

## Upstream API

| Env | Role |
|-----|------|
| `QUERY_API_URL` | Validated in `apps/web/src/config/env.ts` (single source of truth for server env). Base URL for **query-api** (no `NEXT_PUBLIC_`). Default: `http://localhost:7000`. |

HTTP call (via `queryApiFetch` in `apps/web/src/modules/user-profile/infrastructure/clients/query-api.client.ts`, which reads `env.QUERY_API_URL`):

`GET {QUERY_API_URL}/query/v1/users/{name}/profile`

- Cached for 60 s by `queryApiFetch` (`'use cache'`, keyed by URL, method, headers and body) — see [caching.md](../../caching.md).
- Any non-OK status or network failure → `null` (`queryApiFetch` never throws); the head client distinguishes a 404 (`missing`) from the rest (`unavailable`) with `queryApiFetchOutcome`.

## `server-only` client and env

`apps/web/src/config/env.ts` imports `server-only` and exposes typed `env`. `query-api.client.ts` also imports `server-only` and uses `env.QUERY_API_URL`, so profile fetching stays on the server and cannot be bundled into client components.

## Mapping

| query-api `UserProfileView` | `UserProfileShellUser` (shell props) |
|------------------------------|--------------------------------------|
| `name` | `name`, `id` (= `name`) |
| `displayName` | `displayName` |
| `bio` | `bio` |
| `avatarUrl` | `avatarUrl` |
| `coverImageUrl` | `coverImageUrl` |
| `followerCount` | `followerCount` |
| `followingCount` | `followingCount` |
| `postingCount` | `postingCount` |
| `reputation` | *(not shown in shell yet)* |
| `wobjectsWeight` | `wobjectsWeight` (expertise badge in hero) |

Validation: Zod `userProfileViewSchema` in `apps/web/src/modules/user-profile/application/dto/user-profile.dto.ts` (used by the HTTP repository).

## Deploy order and cache

- **Deploy query-api before (or with) web** so `GET .../profile` includes `wobjectsWeight`. The web schema requires this field; an older API causes profile routes to fail validation.
- Profile responses are cached for 60 s (`queryApiFetch`, `'use cache'`). If a cached JSON predates `wobjectsWeight`, `user-profile.repository.ts` issues one uncached refetch (`QUERY_API_LIVE_INIT`) and normalizes snake_case `wobjects_weight` when present.
- After upgrading query-api in dev, clear stale routes if needed: `Remove-Item -Recurse -Force apps/web/.next`, then restart `pnpm run dev:web`.
- Feed and search/discover user rows use defensive `?? 0` / Zod `.default(0)` for `wobjects_weight` — a stale feed/search API may show `0.00` expertise without throwing; profile shell does not mask a missing field.

## Backend contract

See [query-api user profile spec](../../../../query-api/spec/users-profile-endpoint.md) and [account sidebar spec](../../../../query-api/spec/users-account-sidebar.md).
