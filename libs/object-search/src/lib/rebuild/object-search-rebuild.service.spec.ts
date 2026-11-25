import {
  DEFAULT_GOVERNANCE_SNAPSHOT,
  type AggregatedObject,
} from '@opden-data-layer/objects-domain';
import type { ObjectsCore } from '@opden-data-layer/odl-db-types';

import type {
  ObjectSearchSink,
  ObjectSearchSinkBatch,
  ObjectSearchSinkOptions,
} from '../sink';
import type {
  ObjectSearchSourceBatch,
  ObjectSearchSourceLoader,
} from '../source';
import { ObjectSearchRebuildService } from './object-search-rebuild.service';

function aggregated(
  objectId: string,
  status: ObjectsCore['status'] = 'active',
): AggregatedObject {
  return {
    core: {
      object_id: objectId,
      object_type: 'restaurant',
      creator: 'alice',
      weight: null,
      meta_group_id: null,
      canonical: null,
      canonical_creator: null,
      transaction_id: 'tx',
      status,
      seq: 0,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
    },
    updates: [],
    validity_votes: [],
    favorites: [],
    ownerships: [],
  };
}

class FakeSource implements ObjectSearchSourceLoader {
  constructor(private readonly result: ObjectSearchSourceBatch | Error) {}

  async load(): Promise<ObjectSearchSourceBatch> {
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

class RecordingSink implements ObjectSearchSink {
  readonly calls: {
    batch: ObjectSearchSinkBatch;
    options?: ObjectSearchSinkOptions;
  }[] = [];

  async apply(
    batch: ObjectSearchSinkBatch,
    options?: ObjectSearchSinkOptions,
  ): Promise<void> {
    this.calls.push({ batch, options });
  }
}

function sourceOf(objects: AggregatedObject[]): FakeSource {
  return new FakeSource({
    objects,
    voterWaivPowers: new Map(),
    geoByUpdateId: new Map(),
  });
}

describe('ObjectSearchRebuildService', () => {
  it('applies nothing when the loader fails', async () => {
    const sink = new RecordingSink();
    const service = new ObjectSearchRebuildService(
      new FakeSource(new Error('db down')),
      [sink],
    );

    await expect(
      service.rebuild(['a'], DEFAULT_GOVERNANCE_SNAPSHOT),
    ).rejects.toThrow('db down');
    expect(sink.calls).toHaveLength(0);
  });

  it('ignores ids without a core row and deletes inactive objects', async () => {
    const sink = new RecordingSink();
    const service = new ObjectSearchRebuildService(
      sourceOf([aggregated('active-1'), aggregated('closed-1', 'closed')]),
      [sink],
    );

    const result = await service.rebuild(
      ['active-1', 'closed-1', 'gone-1'],
      DEFAULT_GOVERNANCE_SNAPSHOT,
    );

    expect(result).toEqual({ loaded: 2, upserted: 1, deleted: 1, missing: 1 });
    expect(sink.calls).toHaveLength(1);
    expect(sink.calls[0].batch.upserts.map((doc) => doc.objectId)).toEqual([
      'active-1',
    ]);
    expect(sink.calls[0].batch.deleteIds).toEqual(['closed-1']);
  });

  it('writes to every sink and passes force', async () => {
    const first = new RecordingSink();
    const second = new RecordingSink();
    const service = new ObjectSearchRebuildService(
      sourceOf([aggregated('a')]),
      [first, second],
    );

    await service.rebuild(['a'], DEFAULT_GOVERNANCE_SNAPSHOT, { force: true });

    expect(first.calls[0].options).toEqual({ force: true });
    expect(second.calls).toHaveLength(1);
  });

  it('writes nothing on a dry run', async () => {
    const sink = new RecordingSink();
    const service = new ObjectSearchRebuildService(
      sourceOf([aggregated('a')]),
      [sink],
    );

    const result = await service.rebuild(['a'], DEFAULT_GOVERNANCE_SNAPSHOT, {
      dryRun: true,
    });

    expect(result.upserted).toBe(1);
    expect(sink.calls).toHaveLength(0);
  });
});
