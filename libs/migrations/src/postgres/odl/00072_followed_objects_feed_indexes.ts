import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Hub followed-objects feeds (query-api `POST /users/:name/following-objects/{threads,updates}`).
 * - GIN on `threads.hashtags` serves `hashtags && <followed object ids>`.
 * - `(object_id, created_at_unix DESC, update_id DESC)` serves keyset recency pages per object.
 * @see docs/apps/query-api/spec/followed-objects-feeds.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_threads_hashtags_gin
      ON threads USING GIN (hashtags)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS idx_object_updates_object_created
      ON object_updates (object_id, created_at_unix DESC, update_id DESC)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_object_updates_object_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_threads_hashtags_gin`.execute(db);
}
