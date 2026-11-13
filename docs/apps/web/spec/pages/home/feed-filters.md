---
id: web-pages-home-feed-filters
title: Home feed filters
description: Hub left rail — Trending / Hot / New, My feed, followed accounts and objects by type with 3-day counters — URL scheme and data flow.
tags: [web, page, home, feed, filters]
related:
  - docs/apps/web/spec/pages/home/feed-tabs.md
  - docs/apps/query-api/spec/hub-feed.md
  - docs/apps/query-api/spec/hub-feed-filters.md
type: spec
status: active
scope: web
updated_at: 2026-11-13
---

# Home feed filters

**Back:** [home page](page.md) · [feed tabs](feed-tabs.md) · **API:** [hub feed](../../../../query-api/spec/hub-feed.md), [hub feed filters](../../../../query-api/spec/hub-feed-filters.md)

The left rail of `/` and `/feed/*` filters the central feed. Exactly one rail item is active, and the same filter applies to every tab (Posts, Threads, Activity, Updates).

## Rail

| Section | Items | Who |
|---------|-------|-----|
| Sorts | Trending, Hot, New (site-wide) | Everyone |
| My feed | Followed accounts + followed, favorited and owned objects | Signed in |
| People | Followed accounts (avatar, name, `+N`) | Signed in |
| One section per object type | Followed objects of the type (thumbnail, name, `+N`); the header shows the type's summed `+N` | Signed in |

- `+N` = new items of the **active tab** in the last 3 days; nothing is shown when `N` is 0 or counters are unavailable.
- Each section shows 5 rows; "Show more" loads 5 more in place (server actions `loadMoreHomeFeedFilterUsersAction` / `loadMoreHomeFeedFilterObjectsAction`). A section starts collapsed when its top row has nothing new. Section headers only expand or collapse; they never filter.
- A sort the tab cannot apply (Activity: Trending and Hot; Updates: Hot) is shown disabled with the reason.
- Guests see the sorts and a sign-in prompt (opens the login modal).
- Below `lg` the rail opens in a left `DrawerRegion` from a "Filter: …" button above the feed; choosing a filter closes it.

## URL

Search params on the tab path, one at a time (`modules/home/domain/home-feed-filter.ts`):

| Param | Filter |
|-------|--------|
| `filter=trending\|hot\|new\|my` | Sort or My feed |
| `author=<hive account>` | One account |
| `object=<object id>` | One object |

- Precedence when several are present: `object` > `author` > `filter`; invalid values are ignored.
- No param = default: My feed when signed in; for guests the first sort the tab supports (Trending, or New on Activity).
- Tab links carry the current filter (`buildHomeFeedHref`); rail links replace the URL (`OptimisticNavLink method="replace"`) and highlight optimistically.
- `resolveHomeFeedFilter(tab, requested, signedIn)` gives the applied filter. A sort the tab cannot apply falls back to New and `my` without a session falls back to the guest default; the URL keeps the request (so going back to a tab that supports it restores it) and `HomeFeedFilterNotice` explains the fallback.

## Data flow

| Piece | Where |
|-------|-------|
| Feed pages | `(home)/page.tsx`, `(home)/feed/{threads,activity,updates}/page.tsx`: inside `<Suspense>`, read session + `searchParams`, resolve the filter, fetch page one via `get-home-hub-feed.query.ts` → `POST /query/v1/feed/{tab}` |
| Load more | `(home)/home-feed.actions.ts`: `(filter, cursor)`; the filter is re-validated with `homeFeedFilterSchema` |
| Lists | Keyed by `homeFeedFilterKey`, so a filter change starts a new list; `useHomeFeedPages` dedupes appended items by key (ranked pages can repeat an item) |
| Rail | Parallel slot `(home)/@filters/` (`page.tsx` for `/`, `feed/{threads,activity,updates}/page.tsx`, `default.tsx` → nothing). `HomeFeedFiltersRail` streams in its own `<Suspense>`, so the feed never waits for counters |
| Rail data | `get-home-feed-filters.query.ts` → `GET /query/v1/users/:viewer/feed-filters?tab=` |
| Scroll | `HomeFeedScrollReset` keys `ScrollToTopOnEnter` by pathname + filter |

Caching: Posts and every guest feed use `queryApiFetch` (tag `homeFeed(viewer|guest)`); a signed-in viewer's Threads / Activity / Updates are live (`QUERY_API_LIVE_INIT`, vote and approval state). Rail data is cached with tag `homeFeedFilters(viewer)`. `revalidateUserSocialAfterBroadcast(account)` updates both tags; it runs for the viewer after an account follow (profile hero, social rows), an object follow (object page) and favorites.

## Copy keys

`home_feed_filters_aria`, `home_feed_filters_title`, `home_feed_filters_mobile_trigger`, `home_feed_filter_trending`, `home_feed_filter_hot`, `home_feed_filter_new`, `home_feed_filter_my_feed`, `home_feed_filter_unavailable_on_tab`, `home_feed_filter_section_people`, `home_feed_filter_type_toggle`, `home_feed_filter_show_more`, `home_feed_filters_window`, `home_feed_filter_count_aria`, `home_feed_filters_follow_hint`, `home_feed_filters_guest_body`, `home_feed_filters_sign_in`, `home_feed_filter_empty`, `home_feed_filter_sort_unavailable`, `home_feed_filter_signin_required`.

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns=modules/home` | URL module, tab nav, rail panel, page dedupe |
| `pnpm nx run web-e2e:e2e-instant` | Tab switch keeps `?filter=hot`; Activity explains the fallback |
| Manual (signed in with follows) | Rail counters, object / author filters on every tab, mobile drawer, Back/Forward |
