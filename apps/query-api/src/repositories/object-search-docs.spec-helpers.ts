import {
  PostgresObjectSearchSink,
  type ObjectSearchDocument,
} from '@opden-data-layer/object-search';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import type { Kysely } from 'kysely';

/**
 * Spec helpers for search documents (database specs only; not used by the app).
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */

const FIXTURE_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

/** A document with every list empty; `names` defaults to `[name]`. */
export function searchDocFixture(
  objectId: string,
  overrides: Partial<ObjectSearchDocument> = {},
): ObjectSearchDocument {
  const name = overrides.name ?? null;
  return {
    objectId,
    objectType: 'restaurant',
    groupKey: objectId,
    weight: null,
    createdAt: FIXTURE_CREATED_AT,
    titles: [],
    descriptions: [],
    identifiers: [],
    locality: null,
    geo: null,
    ...overrides,
    name,
    names: overrides.names ?? (name === null ? [] : [name]),
  };
}

/** Writes documents through `PostgresObjectSearchSink` inside the test transaction `trx`. */
export async function seedSearchDocs(
  trx: Kysely<OdlDatabase>,
  docs: readonly ObjectSearchDocument[],
): Promise<void> {
  await new PostgresObjectSearchSink(trx).apply({
    upserts: [...docs],
    deleteIds: [],
  });
}
