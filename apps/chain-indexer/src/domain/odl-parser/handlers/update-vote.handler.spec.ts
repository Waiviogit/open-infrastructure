import { EventEmitter2 } from '@nestjs/event-emitter';
import { UPDATE_TYPES } from '@opden-data-layer/core';

import { NotificationEmitterService } from '../../notification-adapter/notification-emitter.service';
import type { OdlEventContext } from '../odl-action-handler';
import { WriteGuardRunner } from '../guards';
import { UpdateVoteHandler } from './update-vote.handler';
import {
  OBJECT_UPDATE_MUTATED_EVENT,
  ObjectUpdateMutatedEvent,
} from '../object-update-mutated.event';

describe('UpdateVoteHandler posting auth', () => {
  const ctx: OdlEventContext = {
    action: 'update_vote',
    creator: 'bob',
    blockNum: 10,
    transactionIndex: 0,
    operationIndex: 0,
    odlEventIndex: 0,
    transactionId: 'trx-vote',
    timestamp: '2026-01-01T00:00:00.000Z',
    eventSeq: BigInt(1),
    eventIdIndexMap: new Map(),
  };

  const votedUpdate = {
    update_id: 'upd-1',
    object_id: 'obj-1',
    update_type: UPDATE_TYPES.NAME,
  };

  const core = {
    object_id: 'obj-1',
    object_type: 'place',
    creator: 'owner',
  };

  it('TC-009: casts vote under posting auth when payload claims another voter', async () => {
    const findByUpdateIdAndVoter = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue(undefined);
    const notificationEmitter = {
      odlContext: jest.fn().mockReturnValue({}),
      emitWithContext: jest.fn(),
      emitTrxProcessedOdl: jest.fn(),
    } as unknown as NotificationEmitterService;

    const handler = new UpdateVoteHandler(
      {
        create,
        delete: jest.fn(),
        findByUpdateIdAndVoter,
        update: jest.fn(),
      } as unknown as import('../../../repositories').ValidityVotesRepository,
      {
        findByUpdateId: jest.fn().mockResolvedValue(votedUpdate),
      } as unknown as import('../../../repositories').ObjectUpdatesRepository,
      {
        findByObjectId: jest.fn().mockResolvedValue(core),
      } as unknown as import('../../../repositories').ObjectsCoreRepository,
      { check: jest.fn().mockReturnValue(null) } as unknown as WriteGuardRunner,
      { emit: jest.fn() } as unknown as EventEmitter2,
      notificationEmitter,
    );

    await handler.handle(
      {
        update_id: 'upd-1',
        voter: 'alice',
        vote: 'for',
      },
      ctx,
    );

    expect(findByUpdateIdAndVoter).toHaveBeenCalledWith('upd-1', 'bob');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ voter: 'bob', vote: 'for' }),
    );
    expect(findByUpdateIdAndVoter).not.toHaveBeenCalledWith('upd-1', 'alice');
    expect(create).not.toHaveBeenCalledWith(
      expect.objectContaining({ voter: 'alice' }),
    );
  });

  it('casts vote under posting auth when payload omits voter', async () => {
    const findByUpdateIdAndVoter = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue(undefined);
    const notificationEmitter = {
      odlContext: jest.fn().mockReturnValue({}),
      emitWithContext: jest.fn(),
      emitTrxProcessedOdl: jest.fn(),
    } as unknown as NotificationEmitterService;

    const handler = new UpdateVoteHandler(
      {
        create,
        delete: jest.fn(),
        findByUpdateIdAndVoter,
        update: jest.fn(),
      } as unknown as import('../../../repositories').ValidityVotesRepository,
      {
        findByUpdateId: jest.fn().mockResolvedValue(votedUpdate),
      } as unknown as import('../../../repositories').ObjectUpdatesRepository,
      {
        findByObjectId: jest.fn().mockResolvedValue(core),
      } as unknown as import('../../../repositories').ObjectsCoreRepository,
      { check: jest.fn().mockReturnValue(null) } as unknown as WriteGuardRunner,
      { emit: jest.fn() } as unknown as EventEmitter2,
      notificationEmitter,
    );

    await handler.handle(
      {
        update_id: 'upd-1',
        voter: undefined,
        vote: 'for',
      },
      ctx,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ voter: 'bob', vote: 'for' }),
    );
  });
});

describe('UpdateVoteHandler object update mutated event', () => {
  const ctx: OdlEventContext = {
    action: 'update_vote',
    creator: 'bob',
    blockNum: 10,
    transactionIndex: 0,
    operationIndex: 0,
    odlEventIndex: 0,
    transactionId: 'trx-vote',
    timestamp: '2026-01-01T00:00:00.000Z',
    eventSeq: BigInt(1),
    eventIdIndexMap: new Map(),
  };

  function setup(existingVote?: 'for' | 'against') {
    const emit = jest.fn();
    const handler = new UpdateVoteHandler(
      {
        create: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        findByUpdateIdAndVoter: jest
          .fn()
          .mockResolvedValue(existingVote ? { vote: existingVote } : undefined),
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as import('../../../repositories').ValidityVotesRepository,
      {
        findByUpdateId: jest.fn().mockResolvedValue({
          update_id: 'upd-1',
          object_id: 'obj-1',
          update_type: UPDATE_TYPES.NAME,
        }),
      } as unknown as import('../../../repositories').ObjectUpdatesRepository,
      {
        findByObjectId: jest
          .fn()
          .mockResolvedValue({ object_id: 'obj-1', object_type: 'place', creator: 'owner' }),
      } as unknown as import('../../../repositories').ObjectsCoreRepository,
      { check: jest.fn().mockReturnValue(null) } as unknown as WriteGuardRunner,
      { emit } as unknown as EventEmitter2,
      {
        odlContext: jest.fn().mockReturnValue({}),
        emitWithContext: jest.fn(),
        emitTrxProcessedOdl: jest.fn(),
      } as unknown as NotificationEmitterService,
    );
    return { handler, emit };
  }

  const mutated = new ObjectUpdateMutatedEvent('obj-1', UPDATE_TYPES.NAME);

  it('emits on a new vote', async () => {
    const { handler, emit } = setup();

    await handler.handle({ update_id: 'upd-1', vote: 'for' }, ctx);

    expect(emit).toHaveBeenCalledWith(OBJECT_UPDATE_MUTATED_EVENT, mutated);
  });

  it('emits on a vote removal', async () => {
    const { handler, emit } = setup('for');

    await handler.handle({ update_id: 'upd-1', vote: 'remove' }, ctx);

    expect(emit).toHaveBeenCalledWith(OBJECT_UPDATE_MUTATED_EVENT, mutated);
  });

  it('does not emit when the same vote is cast again', async () => {
    const { handler, emit } = setup('for');

    await handler.handle({ update_id: 'upd-1', vote: 'for' }, ctx);

    expect(emit).not.toHaveBeenCalledWith(OBJECT_UPDATE_MUTATED_EVENT, expect.anything());
  });
});
