---
id: docs-apps-scheduler-spec-feed-activity-buckets
title: Feed activity buckets
description: Hourly item counts per author and object for the hub feed "new in 3 days" counters.
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

## What is counted

The same items the hub feed shows for the matching author or object filter:

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
| `feed-activity-buckets-refresh` | `*/5 * * * *` | Current hour + previous hour (`FEED_ACTIVITY_BUCKETS_REFRESH_HOURS = 2`) | — |
| `feed-activity-buckets-rebuild` | `20 4 * * *` | Last 72 hours (`FEED_ACTIVITY_BUCKETS_WINDOW_HOURS`) | Deletes buckets older than 96 hours (`FEED_ACTIVITY_BUCKETS_RETENTION_HOURS`) |

Constants: `apps/scheduler/src/constants/feed-activity-buckets.constants.ts`.

For each tab, `FeedActivityBucketsService` runs one transaction: `pg_advisory_xact_lock` on the tab, delete the tab's buckets from the range start, insert fresh counts (`INSERT … SELECT … GROUP BY`, `ON CONFLICT DO UPDATE`). Readers see either the old or the new range, never a half-written one.

## Idempotency and freshness

- A run replaces its range, so duplicate ticks, retries and reindexing give the same result. Deleted content disappears on the next run that covers its hour.
- Items indexed late (time older than the refresh range) are counted by the next daily rebuild.
- Counters lag content by up to one refresh interval (5 minutes) plus the query-api cache TTL.

## Deploy

After applying migration `00075`, run the rebuild once so the whole window is filled before the first daily tick:

```text
node dist/apps/scheduler/main.js --run-job=feed-activity-buckets-rebuild
```

## Code

- Service: `apps/scheduler/src/domain/feed-activity-buckets/feed-activity-buckets.service.ts`
- Repository (SQL per tab): `apps/scheduler/src/repositories/feed-activity-buckets.repository.ts`
- Jobs: `apps/scheduler/src/jobs/feed-activity-buckets-{refresh,rebuild}.job.ts`

## Verification

```bash
pnpm test:db:up
POSTGRES_TEST_URL=postgres://test:test@127.0.0.1:55432/test pnpm nx test scheduler --testPathPatterns=feed-activity
pnpm test:db:down
```
