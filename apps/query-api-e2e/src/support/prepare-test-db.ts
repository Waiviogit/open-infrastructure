/**
 * Waits for the disposable test Postgres, refuses any database other than `test` and
 * migrates it to the latest schema. Run by global setup through `tsx` so workspace
 * aliases resolve (Jest global setup does not apply module mapping).
 */
import { migrateToLatest } from '@opden-data-layer/migrations';
import {
  assertTestDatabase,
  resolveTestPostgresUrl,
  waitForTestPostgres,
} from '@opden-data-layer/test-postgres';

async function main(): Promise<void> {
  const url = resolveTestPostgresUrl();
  assertTestDatabase(url);
  await waitForTestPostgres();
  const result = await migrateToLatest({ connectionString: url });
  if (result.error) {
    throw result.error;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`prepare-test-db failed: ${(error as Error).message}\n`);
  process.exit(1);
});
