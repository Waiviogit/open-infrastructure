jest.mock('@opden-data-layer/objects-domain', () => {
  const actual = jest.requireActual('@opden-data-layer/objects-domain') as typeof import('@opden-data-layer/objects-domain');
  return {
    ...actual,
    materializeObjectCoreStatus: jest.fn(),
  };
});

import {
  materializeObjectCoreStatus,
  ObjectViewService,
} from '@opden-data-layer/objects-domain';

import { ObjectStatusHandler } from './object-status.handler';
import { ObjectStatusRecomputeEvent } from '../object-status-created.event';
import {
  OBJECT_ACTIVE_STATE_CHANGED_EVENT,
  ObjectActiveStateChangedEvent,
} from '../object-active-state-changed.event';

const materializeMock = materializeObjectCoreStatus as jest.MockedFunction<
  typeof materializeObjectCoreStatus
>;

describe('ObjectStatusHandler', () => {
  const aggregated = {
    core: {
      object_id: 'o1',
      object_type: 'place',
      creator: 'alice',
      weight: null,
      meta_group_id: null,
      canonical: null,
      canonical_creator: null,
      transaction_id: 'tx0',
      status: 'active' as const,
      seq: 0,
      created_at: new Date(),
    },
    updates: [],
    validity_votes: [],
    favorites: [],
    ownerships: [],
  };

  const emit = jest.fn();
  const TRX = { kind: 'trx' };
  /** Records whether a call ran inside `db.transaction().execute`. */
  let inTransaction = false;
  const db = {
    transaction: () => ({
      execute: async (fn: (trx: unknown) => Promise<void>) => {
        inTransaction = true;
        try {
          await fn(TRX);
        } finally {
          inTransaction = false;
        }
      },
    }),
  };
  const searchEnqueuedInTransaction: boolean[] = [];
  const searchQueue = {
    enqueue: jest.fn(async () => {
      searchEnqueuedInTransaction.push(inTransaction);
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    searchEnqueuedInTransaction.length = 0;
  });

  it('updates objects_core when materialized status differs', async () => {
    materializeMock.mockReturnValue('unavailable');
    const governanceCacheService = {
      resolvePlatform: jest.fn().mockResolvedValue({ admins: [] }),
    };
    const aggregatedObjectRepository = {
      loadByObjectIds: jest.fn().mockResolvedValue({
        objects: [aggregated],
        voterWaivPowers: new Map(),
      }),
    };
    const update = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const handler = new ObjectStatusHandler(
      governanceCacheService as never,
      aggregatedObjectRepository as never,
      new ObjectViewService(),
      { update } as never,
      { enqueue } as never,
      { emit } as never,
      searchQueue as never,
      db as never,
    );

    await handler.handleObjectStatusRecompute(new ObjectStatusRecomputeEvent('o1'));

    expect(governanceCacheService.resolvePlatform).toHaveBeenCalledTimes(1);
    expect(materializeMock).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('o1', { status: 'unavailable' }, TRX);
    expect(searchQueue.enqueue).toHaveBeenCalledWith('o1', expect.any(Number), TRX);
    expect(searchEnqueuedInTransaction).toEqual([true]);
    expect(enqueue).toHaveBeenCalledWith('o1', expect.any(Number));
    expect(emit).toHaveBeenCalledWith(
      OBJECT_ACTIVE_STATE_CHANGED_EVENT,
      new ObjectActiveStateChangedEvent('o1', 'place', false),
    );
  });

  it('sets core to active when protected wins materialization', async () => {
    materializeMock.mockReturnValue('active');
    const aggregatedUnavailable = {
      ...aggregated,
      core: { ...aggregated.core, status: 'unavailable' as const },
    };
    const update = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const handler = new ObjectStatusHandler(
      { resolvePlatform: jest.fn().mockResolvedValue({}) } as never,
      {
        loadByObjectIds: jest.fn().mockResolvedValue({
          objects: [aggregatedUnavailable],
          voterWaivPowers: new Map(),
        }),
      } as never,
      new ObjectViewService(),
      { update } as never,
      { enqueue } as never,
      { emit } as never,
      searchQueue as never,
      db as never,
    );

    await handler.handleObjectStatusRecompute(new ObjectStatusRecomputeEvent('o1'));

    expect(update).toHaveBeenCalledWith('o1', { status: 'active' }, TRX);
    expect(searchQueue.enqueue).toHaveBeenCalledWith('o1', expect.any(Number), TRX);
    expect(searchEnqueuedInTransaction).toEqual([true]);
    expect(enqueue).toHaveBeenCalledWith('o1', expect.any(Number));
    expect(emit).toHaveBeenCalledWith(
      OBJECT_ACTIVE_STATE_CHANGED_EVENT,
      new ObjectActiveStateChangedEvent('o1', 'place', true),
    );
  });

  it('skips update when materialized status unchanged', async () => {
    materializeMock.mockReturnValue('active');
    const update = jest.fn();
    const handler = new ObjectStatusHandler(
      { resolvePlatform: jest.fn().mockResolvedValue({}) } as never,
      {
        loadByObjectIds: jest.fn().mockResolvedValue({
          objects: [aggregated],
          voterWaivPowers: new Map(),
        }),
      } as never,
      new ObjectViewService(),
      { update } as never,
      { enqueue: jest.fn() } as never,
      { emit } as never,
      searchQueue as never,
      db as never,
    );

    await handler.handleObjectStatusRecompute(new ObjectStatusRecomputeEvent('o1'));

    expect(update).not.toHaveBeenCalled();
    expect(searchQueue.enqueue).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not enqueue the search document when the status stays non-active', async () => {
    materializeMock.mockReturnValue('closed');
    const aggregatedUnavailable = {
      ...aggregated,
      core: { ...aggregated.core, status: 'unavailable' as const },
    };
    const update = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const handler = new ObjectStatusHandler(
      { resolvePlatform: jest.fn().mockResolvedValue({}) } as never,
      {
        loadByObjectIds: jest.fn().mockResolvedValue({
          objects: [aggregatedUnavailable],
          voterWaivPowers: new Map(),
        }),
      } as never,
      new ObjectViewService(),
      { update } as never,
      { enqueue } as never,
      { emit } as never,
      searchQueue as never,
      db as never,
    );

    await handler.handleObjectStatusRecompute(new ObjectStatusRecomputeEvent('o1'));

    expect(update).toHaveBeenCalledWith('o1', { status: 'closed' }, TRX);
    expect(searchQueue.enqueue).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('fails the status transaction when the search enqueue fails', async () => {
    materializeMock.mockReturnValue('unavailable');
    const update = jest.fn().mockResolvedValue(undefined);
    const failingQueue = { enqueue: jest.fn().mockRejectedValue(new Error('queue down')) };
    const handler = new ObjectStatusHandler(
      { resolvePlatform: jest.fn().mockResolvedValue({}) } as never,
      {
        loadByObjectIds: jest.fn().mockResolvedValue({
          objects: [aggregated],
          voterWaivPowers: new Map(),
        }),
      } as never,
      new ObjectViewService(),
      { update } as never,
      { enqueue: jest.fn() } as never,
      { emit } as never,
      failingQueue as never,
      db as never,
    );

    await expect(
      handler.handleObjectStatusRecompute(new ObjectStatusRecomputeEvent('o1')),
    ).rejects.toThrow('queue down');
    expect(update).toHaveBeenCalledWith('o1', { status: 'unavailable' }, TRX);
    expect(emit).not.toHaveBeenCalled();
  });

  it('materializes for non-admin winning updates without admin gate', async () => {
    materializeMock.mockReturnValue('unavailable');
    const update = jest.fn().mockResolvedValue(undefined);
    const handler = new ObjectStatusHandler(
      { resolvePlatform: jest.fn().mockResolvedValue({ admins: ['admin1'] }) } as never,
      {
        loadByObjectIds: jest.fn().mockResolvedValue({
          objects: [aggregated],
          voterWaivPowers: new Map(),
        }),
      } as never,
      new ObjectViewService(),
      { update } as never,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
      { emit } as never,
      searchQueue as never,
      db as never,
    );

    await handler.handleObjectStatusRecompute(new ObjectStatusRecomputeEvent('o1'));

    expect(update).toHaveBeenCalledWith('o1', { status: 'unavailable' }, TRX);
  });
});
