/**
 * Enqueue full recompute of object_categories and object_categories_related scopes.
 *
 * Usage:
 *   pnpm exec tsx --tsconfig tsconfig.base.json --env-file=.env scripts/backfill-object-categories.ts [--dry-run] [--only-objects] [--only-scopes] [--cleanup-legacy-scopes]
 *   pnpm exec tsx --tsconfig tsconfig.base.json --env-file=.env scripts/backfill-object-categories.ts --user alice [--dry-run] ...
 *
 * `--user <account>`: only objects tied to that account (creator, favorite, or
 * post_objects.author) and only that user's per-type scope keys (no global scope row).
 *
 * Scopes: one user scope per `(account, category type)` pair present in
 * object_favorite ∪ post_objects.author (see docs/apps/chain-indexer/spec/object-categories.md),
 * plus every existing per-type user scope so rows built under older rules are rebuilt.
 *
 * `--cleanup-legacy-scopes`: delete user scope rows and queue rows whose key is not a canonical
 * `account:type` key (`alice`, `alice:book,product`, non-category types).
 *
 * Requires POSTGRES_HOST, POSTGRES_USER, POSTGRES_DATABASE (and optionally POSTGRES_PASSWORD, POSTGRES_PORT).
 * DB connection is skipped when --dry-run.
 */
import { resolveConnectionString } from '../libs/migrations/src/connection';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { CATEGORY_OBJECT_TYPES, parseUserCategoryScopeKey } from '@opden-data-layer/core';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

interface CliOptions {
  dryRun: boolean;
  onlyObjects: boolean;
  onlyScopes: boolean;
  cleanupLegacyScopes: boolean;
  /** Hive account — filter objects and scopes to this user only. */
  userAccount: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let onlyObjects = false;
  let onlyScopes = false;
  let cleanupLegacyScopes = false;
  let userAccount: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) {
      continue;
    }
    if (a === '--dry-run') dryRun = true;
    if (a === '--only-objects') onlyObjects = true;
    if (a === '--only-scopes') onlyScopes = true;
    if (a === '--cleanup-legacy-scopes') cleanupLegacyScopes = true;
    if (a === '--user') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        fail('--user requires an account name (e.g. --user alice).');
      }
      userAccount = next.trim();
      i++;
      continue;
    }
    if (a.startsWith('--user=')) {
      userAccount = a.slice('--user='.length).trim();
    }
  }

  if (userAccount !== null && userAccount.length === 0) {
    fail('--user value must be a non-empty account name.');
  }

  return { dryRun, onlyObjects, onlyScopes, cleanupLegacyScopes, userAccount };
}

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

/** Re-enqueue refreshes `enqueued_at` like the chain-indexer queue repositories. */
const RELATED_QUEUE_ON_CONFLICT = sql`
  ON CONFLICT (scope_type, scope_key) DO UPDATE SET
    enqueued_at = GREATEST(
      object_categories_related_sync_queue.enqueued_at + 1,
      EXCLUDED.enqueued_at
    ),
    attempts = 0
`;

async function enqueueObjects(
  db: Kysely<OdlDatabase>,
  enqueuedAt: number,
  account: string | null,
): Promise<void> {
  const accountFilter = account
    ? sql`AND (
        EXISTS (
          SELECT 1 FROM objects_core oc
          WHERE oc.object_id = ou.object_id AND oc.creator = ${account}
        )
        OR EXISTS (
          SELECT 1 FROM object_favorite ofav
          WHERE ofav.object_id = ou.object_id AND ofav.account = ${account}
        )
        OR EXISTS (
          SELECT 1 FROM post_objects po
          WHERE po.object_id = ou.object_id AND po.author = ${account}
        )
      )`
    : sql``;
  await sql`
    INSERT INTO object_categories_sync_queue (object_id, enqueued_at, attempts, last_attempt_at)
    SELECT DISTINCT ou.object_id, ${enqueuedAt}::bigint, 0::integer, NULL::bigint
    FROM object_updates ou
    WHERE ou.update_type = ${'category'}
    ${accountFilter}
    ON CONFLICT (object_id) DO UPDATE SET
      enqueued_at = GREATEST(object_categories_sync_queue.enqueued_at + 1, EXCLUDED.enqueued_at),
      attempts = 0
  `.execute(db);
}

/**
 * One INSERT … SELECT of every `account:type` scope (key format of `buildUserCategoryScopeKey`)
 * plus existing per-type user scopes, optionally for one account.
 */
async function enqueueUserScopes(
  db: Kysely<OdlDatabase>,
  enqueuedAt: number,
  account: string | null,
): Promise<void> {
  const types = [...CATEGORY_OBJECT_TYPES];
  const memberFilter = account ? sql`WHERE members.account = ${account}` : sql``;
  const existingFilter = account
    ? sql`AND scope_key LIKE ${`${account.replace(/[\\%_]/g, '\\$&')}:%`}`
    : sql``;
  await sql`
    INSERT INTO object_categories_related_sync_queue
      (scope_type, scope_key, enqueued_at, attempts, last_attempt_at)
    SELECT 'user', keys.scope_key, ${enqueuedAt}::bigint, 0::integer, NULL::bigint
    FROM (
      SELECT members.account || ':' || oc.object_type AS scope_key
      FROM (
        SELECT object_id, account FROM object_favorite
        UNION
        SELECT object_id, author AS account FROM post_objects
      ) members
      INNER JOIN objects_core oc
        ON oc.object_id = members.object_id AND oc.object_type = ANY(${types}::text[])
      ${memberFilter}
      UNION
      SELECT DISTINCT scope_key
      FROM object_categories_related
      WHERE scope_type = 'user'
        AND regexp_replace(scope_key, '^.*:', '') = ANY(${types}::text[])
        AND strpos(scope_key, ':') > 1
        ${existingFilter}
    ) keys
    ${RELATED_QUEUE_ON_CONFLICT}
  `.execute(db);
}

/** Deletes user scope rows / queue rows whose key `parseUserCategoryScopeKey` rejects. */
async function cleanupLegacyScopes(
  db: Kysely<OdlDatabase>,
  account: string | null,
): Promise<number> {
  const accountFilter = account
    ? sql`AND (scope_key = ${account} OR split_part(scope_key, ':', 1) = ${account})`
    : sql``;
  const { rows } = await sql<{ scope_key: string }>`
    SELECT scope_key FROM object_categories_related WHERE scope_type = 'user' ${accountFilter}
    UNION
    SELECT scope_key FROM object_categories_related_sync_queue WHERE scope_type = 'user' ${accountFilter}
  `.execute(db);
  const legacyKeys = rows
    .map((r) => r.scope_key)
    .filter((key) => parseUserCategoryScopeKey(key) === null);
  if (legacyKeys.length === 0) {
    return 0;
  }
  await sql`
    DELETE FROM object_categories_related
    WHERE scope_type = 'user' AND scope_key = ANY(${legacyKeys}::text[])
  `.execute(db);
  await sql`
    DELETE FROM object_categories_related_sync_queue
    WHERE scope_type = 'user' AND scope_key = ANY(${legacyKeys}::text[])
  `.execute(db);
  return legacyKeys.length;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const pool = opts.dryRun ? null : new pg.Pool({ connectionString: resolveConnectionString() });
  const db = pool
    ? new Kysely<OdlDatabase>({ dialect: new PostgresDialect({ pool }) })
    : null;

  const enqueuedAt = Math.floor(Date.now() / 1000);
  const doObjects = !opts.onlyScopes;
  const doScopes = !opts.onlyObjects;
  const accountFilter = opts.userAccount;

  try {
    if (!db) {
      // eslint-disable-next-line no-console
      console.log(
        [
          doObjects &&
            `[dry-run] Would enqueue category object_ids${accountFilter ? ` for account=${accountFilter} (creator / favorite / post_objects.author)` : ''}.`,
          opts.cleanupLegacyScopes &&
            '[dry-run] Would delete legacy user scope rows and queue rows (non account:type keys).',
          doScopes &&
            (accountFilter
              ? `[dry-run] Would enqueue per-type user scopes for account=${accountFilter} (no global row).`
              : `[dry-run] Would enqueue global scope + every (account, type) scope for types ${CATEGORY_OBJECT_TYPES.join(', ')}.`),
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }

    if (doObjects) {
      await enqueueObjects(db, enqueuedAt, accountFilter);
    }

    if (opts.cleanupLegacyScopes) {
      const removed = await cleanupLegacyScopes(db, accountFilter);
      // eslint-disable-next-line no-console
      console.log(`Deleted ${removed} legacy user scope key(s).`);
    }

    if (doScopes) {
      if (!accountFilter) {
        await sql`
          INSERT INTO object_categories_related_sync_queue
            (scope_type, scope_key, enqueued_at, attempts, last_attempt_at)
          VALUES ('global', '_', ${enqueuedAt}::bigint, 0::integer, NULL::bigint)
          ${RELATED_QUEUE_ON_CONFLICT}
        `.execute(db);
      }
      await enqueueUserScopes(db, enqueuedAt, accountFilter);
    }

    // eslint-disable-next-line no-console
    console.log(
      `Done. do_objects=${doObjects} do_scopes=${doScopes} cleanup_legacy_scopes=${opts.cleanupLegacyScopes} user=${accountFilter ?? '(all)'} enqueued_at=${enqueuedAt}`,
    );
    // eslint-disable-next-line no-console
    console.log('Run chain-indexer workers until both queues drain.');
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
