---
id: docs-apps-query-api-spec-hub-feed-filters
title: Hub feed filters (rail counters)
description: Followed accounts and followed objects by type with "new in the last 3 days" counters for the hub left rail.
type: spec
status: active
scope: query-api
tags: [query-api, hub-feed, counters]
updated_at: 2026-11-13
related:
  - docs/apps/query-api/spec/hub-feed.md
  - docs/apps/scheduler/spec/feed-activity-buckets.md
---

# Hub feed filters (rail counters)

**Back:** [query-api overview](overview.md)

The hub start page's left rail lists the account's followed accounts and followed objects (grouped by object type). Each row shows how many new items it has in the last 72 hours on the active tab. Clicking a row filters the [hub feed](hub-feed.md) (`author` / `object` filter). The object type header is only a collapsible group; its number is the sum of its objects.

## HTTP

| Method | Path | Query | Response |
|--------|------|-------|----------|
| `GET` | `/query/v1/users/:name/feed-filters` | `tab` (required), `users_limit` = 5, `objects_limit` = 5 (0–50) | `HubFeedFilters` |
| `GET` | `/query/v1/users/:name/feed-filters/users` | `tab`, `skip` = 0, `limit` = 5 | `{ items, hasMore }` |
| `GET` | `/query/v1/users/:name/feed-filters/objects` | `tab`, `object_type`, `skip` = 0, `limit` = 5 | `{ items, hasMore }` |

`tab` is `posts`, `threads`, `activity` or `updates`. 404 when `:name` is not in `accounts_current`. Public: follows are public; `X-Viewer` only fills viewer fields of object projections.

`HubFeedFilters`:

```jsonc
{
  "tab": "posts",
  "windowHours": 72,
  "windowStart": 1794308400,       // unix seconds, first hour counted
  "countsAvailable": true,         // false: counting timed out, every count is null
  "users": { "items": [{ "name", "avatarUrl", "count" }], "total": 12, "hasMore": true },
  "objectTypes": [
    { "objectType": "restaurant", "count": 7, "total": 9,
      "objects": { "items": [{ "objectId", "objectType", "count", "object": ProjectedObject|null }], "hasMore": true } }
  ]
}
```

## Order

| Section | Order |
|---------|-------|
| Accounts | count DESC, `accounts_current.wobjects_weight` DESC, name |
| Objects in a type | count DESC, `objects_core.weight` DESC, object id |
| Object types | summed count DESC, type name |

"Show more" routes slice the same sorted snapshot, so pages never overlap.

## Counting

- Counts come only from `feed_activity_buckets` ([feed activity buckets](../../scheduler/spec/feed-activity-buckets.md)): for every follow, the sum of its hourly buckets of the tab from `windowStart` (the current hour plus the 71 before it). No content table is scanned per request; each follow is a primary-key range read of at most 72 rows.
- Follows: `user_subscriptions` (accounts) and `user_object_follows` joined to **active** `objects_core`. Lists are capped at `HUB_FEED_FILTERS_MAX_FOLLOWS` (5 000, newest follows kept).
- Type count = sum of its objects' counts (an item linked to two followed objects of one type counts twice).
- Numbers lag content by up to the scheduler refresh (5 minutes) plus the cache TTL, and do not apply the viewer's mutes.

## Time budget and cache

- The counting query runs with `SET LOCAL statement_timeout = 300ms` (`HUB_FEED_FILTER_COUNTS_TIMEOUT_MS`). On timeout or failure the endpoint returns the follow list with `count: null` and `countsAvailable: false`; that answer is not cached.
- A sorted snapshot per (account, tab) is cached in Redis: key `query-api:cache:hub-feed-filters:{account}:{tab}`, TTL `HUB_FEED_FILTER_COUNTS_CACHE_TTL_SEC` (300 s). The summary and both "show more" routes read the same snapshot; only the returned slice is hydrated (avatars via `loadAccountAvatarUrls`, objects via `projectFeedObjectsById`).

## Implementation

- Endpoints: `GetUserFeedFiltersEndpoint`, `GetUserFeedFilterUsersEndpoint`, `GetUserFeedFilterObjectsEndpoint` (`apps/query-api/src/domain/hub-feed/`)
- Snapshot: `HubFeedFilterSnapshotService` (cache, fallback), `buildHubFeedFilterSnapshot` (order, sums)
- Repository: `HubFeedFilterCountsRepository`
- Controller: `HubFeedFiltersController`; OpenAPI `openapi/hub-feed.openapi.ts`
- MCP: `get_user_feed_filters`, `get_user_feed_filter_users`, `get_user_feed_filter_objects`

## Verification

```bash
pnpm test:db:up
POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test query-api --testPathPatterns=hub-feed-filter
pnpm test:db:down
```
