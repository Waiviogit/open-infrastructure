import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Hub feed rail: which accounts / objects have any item of a hub tab, and when the latest
 * one was. The rail lists only follows present on the tab. Scheduler-owned: refreshed from
 * fresh buckets, rebuilt weekly from full history.
 * @see docs/apps/scheduler/spec/feed-activity-buckets.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS feed_activity_presence (
      tab            TEXT NOT NULL,
      entity_kind    TEXT NOT NULL,
      entity_id      TEXT NOT NULL,
      last_item_unix BIGINT NOT NULL,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tab, entity_kind, entity_id),
      CONSTRAINT feed_activity_presence_tab_check
        CHECK (tab IN ('posts', 'threads', 'activity', 'updates')),
      CONSTRAINT feed_activity_presence_entity_kind_check
        CHECK (entity_kind IN ('user', 'object'))
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS feed_activity_presence`.execute(db);
}
