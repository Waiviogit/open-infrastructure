---
id: docs-apps-query-api-spec-hub-feed
title: Hub feed
description: Hub start page feeds (Posts, Threads, Activity, Updates) filtered by the left rail — sort, My feed, one author, one object.
type: spec
status: active
scope: query-api
tags: [query-api, home-feed, hub-feed]
updated_at: 2026-11-13
related:
  - docs/apps/query-api/spec/home-feed.md
  - docs/apps/query-api/spec/followed-objects-feeds.md
  - docs/apps/scheduler/spec/feed-activity-buckets.md
---

# Hub feed

**Back:** [query-api overview](overview.md)

The hub start page has four tabs (Posts, Threads, Activity, Updates). The left rail picks exactly one filter, and the same filter applies to every tab.

## Filters

| Filter | Meaning | Order |
|--------|---------|-------|
| `new` | Site-wide, newest first | Time DESC |
| `trending` | Site-wide, created in the last 3 days | Votes (`net_rshares`; Updates: `rank_score`) DESC |
| `hot` | Site-wide, created in the last 3 days | Comments (`children`) DESC |
| `my` | Viewer's followed accounts as authors + the viewer's object set (followed, favorited or owned **active** objects) | Time DESC |
| `author` | One account | Time DESC |
| `object` | One object | Time DESC |

Sorts per tab: Posts and Threads support `trending`, `hot`, `new`; Updates supports `trending`, `new`; Activity supports `new` only (messages have no votes or comments).

Viewer mutes (`user_account_mutes`) exclude authors on every filter except `author`. Activity also applies governance mutes (`resolveActivityExcludedAuthors`).

## What each tab shows

| Tab | Item | `author` filter | `object` filter | Time |
|-----|------|-----------------|-----------------|------|
| Posts | Root posts (`depth = 0` or null) | Own root posts (no reblogs) | Linked through `post_objects` | `created_unix` |
| Threads | `threads` with `deleted = false` | Own threads with `bulk_message = false` (no mentions) | `hashtags` contains the object id | `created_unix` |
| Activity | Canonical messages (`message_id = dup_group_id`) of object channels | `messages.author` | Channel object or `linked_object_ids` | `COALESCE(original_created_at_unix, created_at_unix)` |
| Updates | `object_updates` of active objects | `creator` | `object_id` | `created_at_unix` |

These definitions match the rail counters ([feed activity buckets](../../scheduler/spec/feed-activity-buckets.md)), so a counter and the filtered feed count the same items.

## Query shapes

- **Site-wide `new`:** one keyset scan on the time index of the tab.
- **Ranked:** range scan of the 3-day window on the time index, then a top-N sort by score. Keyset on `(score, author, permlink)` (Updates: `(score, created_at_unix, update_id)`). Votes can move between pages, so a later page can repeat or skip an item; clients dedupe by key.
- **`my`:** each branch (a `LATERAL` page per followed author, the object-set branch) is limited before the merge; the merge dedupes (`UNION` / `DISTINCT ON`).
- **`author` / `object`:** one keyset scan on the author / object index.

Indexes added for these shapes: migration `00075_hub_feed_filters.ts` (see [threads](../../../spec/data-model/threads.md) and [messages](../../../spec/data-model/messages.md) data-model docs).

## Implementation

| Tab | Repository |
|-----|------------|
| Posts | `HubPostsFeedRepository` |
| Threads | `HubThreadsFeedRepository` |
| Activity | `HubActivityFeedRepository` (object filter: `MessagingRepository.listObjectActivityMessages`) |
| Updates | `HubUpdatesFeedRepository` |

Shared SQL fragments (viewer object set, author exclusion, keyset predicates): `apps/query-api/src/repositories/hub-feed-scope.sql.ts`.

## Verification

```bash
pnpm test:db:up
POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test query-api --testPathPatterns=hub-feed
pnpm test:db:down
```
