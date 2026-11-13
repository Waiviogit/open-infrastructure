---
id: docs-apps-scheduler-spec-feed-activity-buckets
title: Feed activity buckets
description: Hourly item counts and per-tab presence of authors and objects for the hub feed rail ("new in 3 days" counters, per-tab follow lists).
type: spec
status: active
scope: scheduler
tags: [scheduler, feed, counters]
updated_at: 2026-11-13
related:
  - docs/apps/scheduler/spec/overview.md
  - docs/spec/data-model/threads.md
  - docs/spec/data-model/messages.md
---

# Feed activity buckets

The hub start page shows, next to every followed account and object, how many new items it has in the last 3 days on the active tab (Posts, Threads, Activity, Updates). Counting that from content tables on every page load would scan 3 days of content per request. Scheduler instead keeps hourly counts in `feed_activity_buckets`, and query-api only sums the buckets of the accounts and objects a user follows.

Each tab's rail also lists only follows that have **any** item of that tab (an account without threads is not on the Threads rail). Scheduler keeps that in `feed_activity_presence`.

## Table

`feed_activity_buckets` (migration `00075_hub_feed_filters.ts`):

| Column | Meaning |
|--------|---------|
| `tab` | `posts`, `threads`, `activity`, `updates` |
| `entity_kind` | `user` (author / creator) or `object` |
| `entity_id` | Account name or object id |
| `bucket_hour` | Unix seconds, start of the hour |
| `item_count` | Items in that hour (always > 0; empty hours have no row) |

Primary key `(tab, entity_kind, entity_id, bucket_hour)`; index `(tab, bucket_hour)`.

`feed_activity_presence` (migration `00076_feed_activity_presence.ts`): `(tab, entity_kind, entity_id)` primary key and `last_item_unix` (time of the latest item; the rail sorts by it after the new-item count).

## What is counted

The same items the hub feed shows for the matching author or object filter. One item list per tab (`tabItemsSql` in the repository) feeds both tables, so presence and counters always agree:

| Tab | `user` row | `object` row | Time |
|-----|------------|--------------|------|
| `posts` | Root posts (`depth = 0` or null) by `author` | Root posts linked through `post_objects` | `created_unix` |
| `threads` | Not deleted, not `bulk_message`, by `author` | Not deleted; each distinct `hashtags` entry that is a known object | `created_unix` |
| `activity` | Canonical messages (`message_id = dup_group_id`) of object channels by `author` | Same messages; channel object and `linked_object_ids`, once per message | `COALESCE(original_created_at_unix, created_at_unix)` |
| `updates` | `object_updates` by `creator` | `object_updates` by `object_id` | `created_at_unix` |

Not applied here: viewer mutes (per viewer, applied by the feed itself) and object status (applied when query-api joins the viewer's follows). A counter can therefore be slightly higher than the visible items of a muted author.

## Jobs

| Job | Schedule | Range recounted | Extra |
|-----|----------|-----------------|-------|
| `feed-activity-buckets-refresh` | `*/30 * * * *` | Current hour + previous hour (`FEED_ACTIVITY_BUCKETS_REFRESH_HOURS = 2`) | Marks the range's authors / objects present |
| `feed-activity-buckets-rebuild` | `20 4 * * *` | Last 72 hours (`FEED_ACTIVITY_BUCKETS_WINDOW_HOURS`) | Marks present; deletes buckets older than 96 hours (`FEED_ACTIVITY_BUCKETS_RETENTION_HOURS`) |
| `feed-activity-presence-rebuild` | `40 4 * * 0` (weekly) | Presence of every tab from full history | Drops accounts / objects whose items are gone. Heavy: scans every content table |

Constants: `apps/scheduler/src/constants/feed-activity-buckets.constants.ts`.

For each tab, `FeedActivityBucketsService` runs one transaction: `pg_advisory_xact_lock` on the tab, delete the tab's buckets from the range start, insert fresh counts (`INSERT … SELECT … GROUP BY`, `ON CONFLICT DO UPDATE`), then upsert presence for the same range (`last_item_unix = GREATEST(old, new)`). Readers see either the old or the new range, never a half-written one. The presence rebuild replaces one tab per transaction (lock, delete, insert from full history).

## Idempotency and freshness

- A run replaces its range, so duplicate ticks, retries and reindexing give the same result. Deleted content disappears on the next run that covers its hour.
- Items indexed late (time older than the refresh range) are counted by the next daily rebuild.
- Counters lag content by up to one refresh interval (30 minutes) plus the query-api cache TTL. A follow's first item on a tab adds it to that tab's rail within the same delay.
- An account / object whose items were all deleted stays present until the weekly presence rebuild (its counter drops to zero earlier).

## Deploy

After applying migrations `00075` and `00076`, run both rebuilds once (presence first; the rail is empty until it ran):

```text
node dist/apps/scheduler/main.js --run-job=feed-activity-presence-rebuild
node dist/apps/scheduler/main.js --run-job=feed-activity-buckets-rebuild
```

## Code

- Service: `apps/scheduler/src/domain/feed-activity-buckets/feed-activity-buckets.service.ts`
- Repository (SQL per tab): `apps/scheduler/src/repositories/feed-activity-buckets.repository.ts`
- Jobs: `apps/scheduler/src/jobs/feed-activity-buckets-{refresh,rebuild}.job.ts`, `feed-activity-presence-rebuild.job.ts`

## Verification

```bash
pnpm test:db:up
POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test scheduler --testPathPatterns=feed-activity
pnpm test:db:down
```
