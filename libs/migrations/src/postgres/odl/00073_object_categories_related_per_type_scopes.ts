import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Category object types at the time of this migration (registry types whose
 * `supported_updates` include `category`). Frozen on purpose: a migration must not depend on the
 * runtime registry, which can change after it ran.
 */
const CATEGORY_OBJECT_TYPES_AT_00073: readonly string[] = [
  'book',
  'product',
  'recipe',
  'service',
  'service_offer',
  'service_request',
];

/**
 * User category scopes become one scope per account and category type (`alice:recipe`), built
 * from favorites ∪ authored post objects (no ownership).
 *
 * 1. Deletes legacy user scope rows and queue rows: keys without `:`, with an empty account, or
 *    whose part after the last `:` is not one category type (multi-type `alice:book,product`,
 *    non-category types).
 * 2. Enqueues every `account:type` pair of the new scope, plus every surviving user scope (their
 *    rows were built with ownership and must be rebuilt).
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const types = [...CATEGORY_OBJECT_TYPES_AT_00073];
  const isCanonicalKey = (column: string) => sql`(
    strpos(${sql.ref(column)}, ':') > 1
    AND regexp_replace(${sql.ref(column)}, '^.*:', '') = ANY(${types}::text[])
  )`;

  await sql`
    DELETE FROM object_categories_related
    WHERE scope_type = 'user' AND NOT ${isCanonicalKey('scope_key')}
  `.execute(db);

  await sql`
    DELETE FROM object_categories_related_sync_queue
    WHERE scope_type = 'user' AND NOT ${isCanonicalKey('scope_key')}
  `.execute(db);

  await sql`
    INSERT INTO object_categories_related_sync_queue
      (scope_type, scope_key, enqueued_at, attempts, last_attempt_at)
    SELECT 'user', keys.scope_key, EXTRACT(EPOCH FROM NOW())::bigint, 0, NULL
    FROM (
      SELECT members.account || ':' || oc.object_type AS scope_key
      FROM (
        SELECT object_id, account FROM object_favorite
        UNION
        SELECT object_id, author AS account FROM post_objects
      ) members
      INNER JOIN objects_core oc ON oc.object_id = members.object_id
      WHERE oc.object_type = ANY(${types}::text[])
      UNION
      SELECT DISTINCT scope_key
      FROM object_categories_related
      WHERE scope_type = 'user'
    ) keys
    ON CONFLICT (scope_type, scope_key) DO NOTHING
  `.execute(db);
}

/** Irreversible: legacy multi-type scopes are not restored; the queue rebuilds per-type scopes. */
export async function down(_db: Kysely<unknown>): Promise<void> {
  return;
}
