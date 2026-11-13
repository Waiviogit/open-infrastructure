---
id: web-pages-home-feed-tabs
title: Home feed tabs
description: Hub FEED tab band — Posts, Threads, Activity, Updates — layout, routes, rendering, empty states.
tags: [web, page, home, feed]
related:
  - docs/apps/web/spec/pages/home/page.md
  - docs/apps/web/spec/pages/home/feed-filters.md
  - docs/apps/query-api/spec/hub-feed.md
type: spec
status: active
scope: web
updated_at: 2026-11-13
---

# Home feed tabs

**Back:** [home page](page.md) · **Filters:** [feed filters](feed-filters.md) · **API:** [hub feed](../../../../query-api/spec/hub-feed.md)

## Layout

`(app)/(hub)/layout.tsx` + `(app)/(hub)/(home)/layout.tsx`:

1. `HubFeedTabBand` (rendered by `(hub)/layout.tsx` on `/` and `/feed/*`, outside the hub content's `lg:overflow-x-clip`, so the band spans the viewport): a full-width band under the sticky hub section nav (FEED / DISCOVER / MARKET). The tabs (`HomeFeedTabNav`: `ScrollableHorizontalTabNav` + `profileSectionTabClass` + `OptimisticNavLink prefetchShell`) are centered, each with an icon: Posts `file-text`, Threads `message-circle`, Activity `activity`, Updates `bell`. The band is not sticky; below `lg` the tabs scroll horizontally.
2. The profile grid: the filter rail (`filters` slot, [feed filters](feed-filters.md)) | the feed | an empty right column (`--shell-right-width`, reserved).

The rail is sticky below the app header and the hub section nav: `HubStickySectionNav` publishes its height as `--hub-section-nav-height` on the hub root, and the rail uses `top: header + section nav + card spacing` with a matching `max-height` (scrolls inside if taller). Below `lg` the rail moves into a drawer opened above the feed. The hub FEED section stays active on `/` and `/feed/*` (`isHomeFeedPath`).

## Tabs

| Tab | Route | Data |
|-----|-------|------|
| Posts | `/` | `POST /query/v1/feed/posts` |
| Threads | `/feed/threads` | `POST /query/v1/feed/threads` |
| Activity | `/feed/activity` | `POST /query/v1/feed/activity` |
| Updates | `/feed/updates` | `POST /query/v1/feed/updates` |

Every tab reads the rail filter from the URL and is available to guests (site-wide sorts). Tabs are real routes; tab links carry the current filter params. `(hub)/layout.tsx` renders `OptimisticNavSync`, so Back/Forward clear the optimistic tab and the band follows the URL. `HomeFeedScrollReset` (`ScrollToTopOnEnter` keyed by pathname + filter) starts every tab or filter switch at the top, while Back/Forward restore the saved offset. `(home)/loading.tsx` and `(home)/feed/loading.tsx` skeleton the content slot. Tab definitions: `HOME_FEED_TABS` in `modules/home/domain/home-feed-tabs.ts`.

## Rendering

| Tab | Component | Items |
|-----|-----------|-------|
| Posts | `HomeFeedPostsList` | `FeedList` / `FeedPostGrid` |
| Threads | `HomeThreadsFeedList` | `FeedList feedTab="threads"`; object chips = active objects named in the hashtags |
| Activity | `HomeActivityFeedList` | `ObjectActivityFeedList`, read-only. The channel object is mapped to `source_object`, so each row links "From {object}" to the object's activity tab |
| Updates | `HomeUpdatesFeedList` | Object header (thumbnail + name → object page) + `UpdateCard` with approve/reject votes |

All lists: first page from the RSC page, load-more through server actions in `(home)/home-feed.actions.ts` bound to the list's filter, `useHomeFeedPages` (`useSyncedPaginatedList` + `useInfiniteScroll`, dedupe by item key), page size `HOME_FEED_PAGE_SIZE` (20).

## Empty states

| Filter | Copy keys |
|--------|-----------|
| My feed | `home_feed_empty_personalized` (Posts), `home_feed_threads_empty`, `home_feed_activity_empty`, `home_feed_updates_empty` |
| Site-wide sorts on Posts | `home_feed_empty_global` |
| Author / object (and sorts on other tabs) | `home_feed_filter_empty` |

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns=modules/home` | Tab nav, filter URL, DTO mapping |
| `pnpm nx run web:typecheck` | Types |
| Manual | Guest: every tab loads (Trending by default). Signed in: My feed on every tab; voting on an update works; Back/Forward keeps the active tab and filter |
