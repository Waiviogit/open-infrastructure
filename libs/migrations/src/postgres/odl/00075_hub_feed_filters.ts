import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Hub feed filters (query-api `POST /feed/{tab}`, `GET /users/:name/feed-filters`).
 * - `feed_activity_buckets`: hourly item counts per author / object and hub tab, rebuilt by
 *   the scheduler so the "new in 3 days" counters never scan content at request time.
 * - Keyset indexes for author / creator / global recency pages on threads, object updates
 *   and canonical activity messages (also used by the bucket refresh job).
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS feed_activity_buckets (
      tab         TEXT NOT NULL,
      entity_kind TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      bucket_hour BIGINT NOT NULL,
      item_count  INTEGER NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tab, entity_kind, entity_id, bucket_hour),
      CONSTRAINT feed_activity_buckets_tab_check
        CHECK (tab IN ('posts', 'threads', 'activity', 'updates')),
      CONSTRAINT feed_activity_buckets_entity_kind_check
        CHECK (entity_kind IN ('user', 'object')),
      CONSTRAINT feed_activity_buckets_item_count_check CHECK (item_count > 0)
    )
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_feed_activity_buckets_tab_hour
      ON feed_activity_buckets (tab, bucket_hour)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_threads_author_created
      ON threads (author, created_unix DESC, permlink DESC)
      WHERE deleted = false
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_object_updates_creator_created
      ON object_updates (creator, created_at_unix DESC, update_id DESC)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_object_updates_created
      ON object_updates (created_at_unix DESC, update_id DESC)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_canonical_activity_time
      ON messages ((COALESCE(original_created_at_unix, created_at_unix)) DESC, event_seq DESC)
      WHERE message_id = dup_group_id
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_author_activity_time
      ON messages (author, (COALESCE(original_created_at_unix, created_at_unix)) DESC, event_seq DESC)
      WHERE message_id = dup_group_id
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_messages_author_activity_time`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_messages_canonical_activity_time`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_object_updates_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_object_updates_creator_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_threads_author_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_feed_activity_buckets_tab_hour`.execute(db);
  await sql`DROP TABLE IF EXISTS feed_activity_buckets`.execute(db);
}
