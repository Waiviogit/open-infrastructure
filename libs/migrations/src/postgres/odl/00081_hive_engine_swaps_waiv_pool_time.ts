import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * WAIV page trading history: every account's swaps in the WAIV/SWAP.HIVE pool, newest first, keyset
 * paginated on `(block_timestamp, id)`. The predicate must match the repository filter literally
 * (`HiveEngineSwapsRepository.findWaivPoolSwaps`) for the planner to use this partial index.
 *
 * Production: build it beforehand with `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` (same definition)
 * — migrations run in a transaction, so this statement locks writes to the table while it builds.
 * @see docs/apps/query-api/spec/waiv-endpoints.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_hes_waiv_pool_ts_id
      ON hive_engine_swaps (block_timestamp DESC, id DESC)
      WHERE symbols @> ARRAY['WAIV', 'SWAP.HIVE']::text[]
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_hes_waiv_pool_ts_id`.execute(db);
}
