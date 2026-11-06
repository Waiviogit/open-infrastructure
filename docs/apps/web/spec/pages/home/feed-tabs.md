---
id: web-pages-home-feed-tabs
title: Home feed tabs
description: Hub FEED left menu — Posts, Activity, Threads, Updates — routes, data sources, guest state.
tags: [web, page, home, feed]
related:
  - docs/apps/web/spec/pages/home/page.md
  - docs/apps/query-api/spec/home-feed.md
  - docs/apps/query-api/spec/followed-objects-feeds.md
  - docs/apps/query-api/spec/osl-messaging.md
type: spec
status: active
scope: web
updated_at: 2026-11-06
---

# Home feed tabs

**Back:** [home page](page.md) · **API:** [home feed](../../../../query-api/spec/home-feed.md), [followed objects feeds](../../../../query-api/spec/followed-objects-feeds.md)

## Layout

`(app)/(hub)/(home)/layout.tsx`: from `lg` a left rail (`HomeFeedMenu orientation="vertical"`, `--shell-left-width`) the feed in the center column and an empty right column (`--shell-right-width`, reserved), same grid as the profile. Below `lg` the same tabs render horizontally above the feed. The rail is sticky below the app header and the hub section nav: `HubStickySectionNav` publishes its measured height as `--hub-section-nav-height` on the hub root, and the rail uses `top: header + section nav + card spacing` with a matching `max-height` (scrolls inside if taller). The hub FEED section tab stays active on `/` and `/feed/*` (`isHomeFeedPath`).

## Tabs

| Tab | Route | Signed in | Guest |
|-----|-------|-----------|-------|
| Posts | `/` | `POST /posts/feed` with `X-Viewer` (personalized) | Same endpoint, all posts newest first |
| Threads | `/feed/threads` | `POST /users/:viewer/following-objects/threads` | `HomeFeedGuestPrompt` |
| Activity | `/feed/activity` | `POST /users/:viewer/following-objects/messages` | `HomeFeedGuestPrompt` |
| Updates | `/feed/updates` | `POST /users/:viewer/following-objects/updates` | `HomeFeedGuestPrompt` |

Tabs are real routes (`OptimisticNavLink`); `(hub)/layout.tsx` renders `OptimisticNavSync` so Back/Forward clear the optimistic tab and the rail and hub section nav follow the URL; `(home)/loading.tsx` and `(home)/feed/loading.tsx` skeleton the content slot while the rail stays. Tab definitions: `HOME_FEED_TABS` in `modules/home/domain/home-feed-tabs.ts`.

## Rendering

| Tab | Component | Items |
|-----|-----------|-------|
| Posts | `HomeFeedPostsList` | `FeedList` / `FeedPostGrid` |
| Threads | `HomeThreadsFeedList` | `FeedList feedTab="threads"`; object chips = followed objects the thread is tagged with |
| Activity | `HomeActivityFeedList` | `ObjectActivityFeedList`, read-only (no reply/edit/delete). The followed object is mapped to `source_object`, so each row links "From {object}" to the object's activity tab |
| Updates | `HomeUpdatesFeedList` | Object header (thumbnail + name → object page) + `UpdateCard` with approve/reject votes |

All lists: first page from the RSC page, load-more through server actions in `(home)/home-feed.actions.ts`, `useHomeFeedPages` (`useSyncedPaginatedList` + `useInfiniteScroll`), page size `HOME_FEED_PAGE_SIZE` (20).

Followed-objects fetches are uncached (`QUERY_API_LIVE_INIT`): they are per viewer and carry vote state.

## Empty and guest states

| State | Copy keys |
|-------|-----------|
| Guest on Activity / Threads / Updates | `home_feed_guest_title`, `home_feed_guest_body`, button `login` (opens the login modal) |
| Signed in, nothing to show | `home_feed_activity_empty`, `home_feed_threads_empty`, `home_feed_updates_empty` |

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns=modules/home` | Tab routing, DTO mapping |
| `pnpm nx run web:typecheck` | Types |
| Manual | Guest: `/` lists posts, other tabs show the sign-in prompt. Signed in with followed objects: each tab loads and scrolls; voting on an update works; back/forward keeps the active tab |
