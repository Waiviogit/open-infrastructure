import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * WAIV price chart `1d` / `7d` read the ~5 min ordinary samples by `created_at` (the `date` column is a
 * day, so it cannot order samples within a day). The table keeps every sample, so the range needs an
 * index instead of a scan of all ordinary rows.
 *
 * Production: build it beforehand with `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` (same definition)
 * — migrations run in a transaction, so this statement locks writes to the table while it builds.
 * @see docs/apps/query-api/spec/currency-engine-chart.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_hive_engine_rates_ordinary_created_at
      ON hive_engine_rates (base, created_at DESC)
      WHERE is_daily = false
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_hive_engine_rates_ordinary_created_at`.execute(db);
}
