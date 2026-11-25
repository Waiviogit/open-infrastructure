import type { Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import {
  DEFAULT_GOVERNANCE_SNAPSHOT,
  ObjectViewService,
  type ResolvedObjectView,
} from '@opden-data-layer/objects-domain';
import {
  OBJECT_STATUS_VALUES,
  type ObjectStatus,
  type OdlDatabase,
} from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../../database';
import { AggregatedObjectRepository } from '../../repositories';
import type { GovernanceResolverService } from '../governance';
import type { ObjectProjectionService } from '../object-projection/object-projection.service';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import { SearchObjectsDisplayService } from './search-objects-display.service';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

const NON_ACTIVE_STATUSES: readonly ObjectStatus[] =
  OBJECT_STATUS_VALUES.filter((status) => status !== 'active');

async function insertCore(
  trx: Trx,
  objectId: string,
  status: ObjectStatus,
): Promise<void> {
  await trx
    .insertInto('objects_core')
    .values({
      object_id: objectId,
      object_type: 'restaurant',
      creator: 'alice',
      transaction_id: `tx-${objectId}`,
      status,
      weight: null,
      meta_group_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
    })
    .execute();
}

function service(trx: Trx): SearchObjectsDisplayService {
  const governanceResolver = {
    resolveMergedForObjectView: jest
      .fn()
      .mockResolvedValue(DEFAULT_GOVERNANCE_SNAPSHOT),
  } as unknown as GovernanceResolverService;
  const projection = {
    batchProject: jest.fn(async (views: ResolvedObjectView[]) =>
      views.map(
        (view) =>
          ({
            object_id: view.object_id,
            object_type: view.object_type,
            fields: {},
          }) as unknown as ProjectedObject,
      ),
    ),
  } as unknown as ObjectProjectionService;
  return new SearchObjectsDisplayService(
    new AggregatedObjectRepository(trx as unknown as Kysely<Database>),
    new ObjectViewService(),
    governanceResolver,
    projection,
  );
}

/**
 * The header list projects search hits through active cores only, so an id whose search document
 * is not yet removed after a deactivation never reaches the client.
 */
describeDb(
  'SearchObjectsDisplayService.projectByObjectIds and object status',
  () => {
    const db = createTestDb();

    beforeAll(async () => {
      const migrated = await migrateToLatest({
        connectionString: resolveTestPostgresUrl(),
      });
      if (migrated.error) {
        throw migrated.error;
      }
    }, 60_000);

    afterAll(async () => {
      await db.destroy();
    });

    it('omits ids whose core row is not active and keeps the order of the rest', async () => {
      await withRollback(db, async (trx) => {
        await insertCore(trx, 'disp-active-b', 'active');
        await insertCore(trx, 'disp-active-a', 'active');
        for (const status of NON_ACTIVE_STATUSES) {
          await insertCore(trx, `disp-${status}`, status);
        }

        const ids = [
          'disp-active-b',
          ...NON_ACTIVE_STATUSES.map((status) => `disp-${status}`),
          'disp-missing',
          'disp-active-a',
        ];
        const results = await service(trx).projectByObjectIds(ids, {
          locale: 'en-US',
        });

        expect(results.map((r) => r.object_id)).toEqual([
          'disp-active-b',
          'disp-active-a',
        ]);
      });
    });
  },
);
