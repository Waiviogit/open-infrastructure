import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Object page experts: `count(*) … WHERE object_id = $1 AND weight > 0` and the top-N experts list
 * (`ORDER BY weight DESC, account`) read every heap page of a popular hashtag (~20k pages) through
 * `(object_id)`. `(object_id, weight DESC, account)` serves both from the index alone and replaces
 * the narrower index.
 *
 * Production: build it beforehand with `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` (same definition)
 * — migrations run in a transaction, so this statement locks writes to the table while it builds.
 * @see docs/apps/query-api/spec/object-head.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_object_expertise_object_weight
      ON user_object_expertise (object_id, weight DESC, account)
  `.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_object_expertise_object_id`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_object_expertise_object_id
      ON user_object_expertise (object_id)
  `.execute(db);
  await sql`DROP INDEX IF EXISTS idx_user_object_expertise_object_weight`.execute(db);
}
