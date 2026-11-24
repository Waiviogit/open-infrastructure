import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Category object types at the time of this migration (registry types whose
 * `supported_updates` include `category`). Frozen on purpose: a migration must not depend on the
 * runtime registry, which can change after it ran.
 */
const CATEGORY_OBJECT_TYPES_AT_00077: readonly string[] = [
  'book',
  'link',
  'person',
  'product',
  'recipe',
  'service',
  'service_offer',
  'service_request',
];

const SCOPE_TYPE_CHECK = 'object_categories_related_scope_type_check';

/**
 * Adds the `type` category scope: one scope per category object type (`scope_key` = the type,
 * e.g. `product`) over all its active objects, for the Discover category tree. A separate scope
 * type keeps per-type rows away from readers of the `global` scope.
 *
 * `related_counts` (parallel to `related_names`) holds the groups shared with each related name;
 * type scopes fill it so query-api can serve the unfiltered root of a type without live counts.
 *
 * Enqueues every category type so the indexer builds the new scopes.
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE object_categories_related
    DROP CONSTRAINT IF EXISTS ${sql.raw(SCOPE_TYPE_CHECK)}
  `.execute(db);
  await sql`
    ALTER TABLE object_categories_related
    ADD CONSTRAINT ${sql.raw(SCOPE_TYPE_CHECK)}
    CHECK (scope_type IN ('global', 'user', 'type'))
  `.execute(db);
  await sql`
    ALTER TABLE object_categories_related
    ADD COLUMN IF NOT EXISTS related_counts INTEGER[] NOT NULL DEFAULT '{}'::integer[]
  `.execute(db);

  const types = [...CATEGORY_OBJECT_TYPES_AT_00077];
  await sql`
    INSERT INTO object_categories_related_sync_queue
      (scope_type, scope_key, enqueued_at, attempts, last_attempt_at)
    SELECT 'type', t.object_type, EXTRACT(EPOCH FROM NOW())::bigint, 0, NULL
    FROM unnest(${types}::text[]) AS t(object_type)
    ON CONFLICT (scope_type, scope_key) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM object_categories_related_sync_queue WHERE scope_type = 'type'`.execute(db);
  await sql`DELETE FROM object_categories_related WHERE scope_type = 'type'`.execute(db);
  await sql`ALTER TABLE object_categories_related DROP COLUMN IF EXISTS related_counts`.execute(db);
  await sql`
    ALTER TABLE object_categories_related
    DROP CONSTRAINT IF EXISTS ${sql.raw(SCOPE_TYPE_CHECK)}
  `.execute(db);
  await sql`
    ALTER TABLE object_categories_related
    ADD CONSTRAINT ${sql.raw(SCOPE_TYPE_CHECK)}
    CHECK (scope_type IN ('global', 'user'))
  `.execute(db);
}
