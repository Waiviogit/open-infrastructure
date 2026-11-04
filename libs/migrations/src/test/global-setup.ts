// Jest globalSetup ignores moduleNameMapper, so the package alias cannot be resolved here.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  assertTestDatabase,
  resolveTestPostgresUrl,
  waitForTestPostgres,
} from '../../../test-postgres/src/index';

import { migrateToLatest } from '../runner';

export default async function globalSetup(): Promise<void> {
  await waitForTestPostgres();
  const url = resolveTestPostgresUrl();
  assertTestDatabase(url);
  const result = await migrateToLatest({ connectionString: url });
  if (result.error) {
    throw result.error;
  }
}
