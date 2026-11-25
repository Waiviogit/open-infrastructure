import { Logger } from '@nestjs/common';
import { UPDATE_TYPES } from '@opden-data-layer/core';
import { SEARCH_DOC_UPDATE_TYPES } from '@opden-data-layer/object-search';

import { GovernanceObjectMutatedEvent } from '../../governance/governance-object-mutated.event';
import { ObjectCreatedEvent } from '../object-created.event';
import { ObjectUpdateMutatedEvent } from '../object-update-mutated.event';
import { OwnershipChangedEvent } from '../ownership-changed.event';
import { ObjectSearchSyncHandler } from './object-search-sync.handler';

const PLATFORM_ID = 'platform-gov';

function setup(opts: { platformId?: string; inheritsFrom?: string[] } = {}) {
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const governanceCacheService = {
    resolvePlatform: jest.fn().mockResolvedValue({
      inherits_from: (opts.inheritsFrom ?? []).map((object_id) => ({ object_id, scope: [] })),
    }),
  };
  const configService = {
    get: jest.fn((key: string) =>
      key === 'governance.objectId' ? (opts.platformId ?? PLATFORM_ID) : undefined,
    ),
  };
  const handler = new ObjectSearchSyncHandler(
    queue as never,
    governanceCacheService as never,
    configService as never,
  );
  return { handler, queue, governanceCacheService };
}

describe('ObjectSearchSyncHandler', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enqueues a created object', async () => {
    const { handler, queue } = setup();

    await handler.handleObjectCreated(new ObjectCreatedEvent('o1', 'place'));

    expect(queue.enqueue).toHaveBeenCalledWith('o1', expect.any(Number));
  });

  it.each([...SEARCH_DOC_UPDATE_TYPES])('enqueues on a %s update mutation', async (updateType) => {
    const { handler, queue } = setup();

    await handler.handleObjectUpdateMutated(new ObjectUpdateMutatedEvent('o1', updateType));

    expect(queue.enqueue).toHaveBeenCalledWith('o1', expect.any(Number));
  });

  it.each([UPDATE_TYPES.CATEGORY, UPDATE_TYPES.STATUS, UPDATE_TYPES.PRODUCT_GROUP_ID])(
    'ignores a %s update mutation',
    async (updateType) => {
      const { handler, queue } = setup();

      await handler.handleObjectUpdateMutated(new ObjectUpdateMutatedEvent('o1', updateType));

      expect(queue.enqueue).not.toHaveBeenCalled();
    },
  );

  it('enqueues on an ownership change', async () => {
    const { handler, queue } = setup();

    await handler.handleOwnershipChanged(new OwnershipChangedEvent('alice', 'o1'));

    expect(queue.enqueue).toHaveBeenCalledWith('o1', expect.any(Number));
  });

  it('logs an enqueue failure instead of throwing', async () => {
    const { handler, queue } = setup();
    queue.enqueue.mockRejectedValueOnce(new Error('db down'));

    await expect(
      handler.handleObjectCreated(new ObjectCreatedEvent('o1', 'place')),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  describe('governance mutation', () => {
    it('warns when the configured platform governance object changes, without enqueueing', async () => {
      const { handler, queue, governanceCacheService } = setup();

      await handler.handleGovernanceObjectMutated(new GovernanceObjectMutatedEvent(PLATFORM_ID));

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('search-docs:rebuild --all'));
      expect(governanceCacheService.resolvePlatform).not.toHaveBeenCalled();
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('warns when an inherited platform governance object changes', async () => {
      const { handler } = setup({ inheritsFrom: ['parent-gov'] });

      await handler.handleGovernanceObjectMutated(new GovernanceObjectMutatedEvent('parent-gov'));

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('stays silent for any other object', async () => {
      const { handler, queue } = setup({ inheritsFrom: ['parent-gov'] });

      await handler.handleGovernanceObjectMutated(new GovernanceObjectMutatedEvent('o1'));

      expect(warn).not.toHaveBeenCalled();
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('stays silent when no platform governance object is configured', async () => {
      const { handler, governanceCacheService } = setup({ platformId: '' });

      await handler.handleGovernanceObjectMutated(new GovernanceObjectMutatedEvent('o1'));

      expect(warn).not.toHaveBeenCalled();
      expect(governanceCacheService.resolvePlatform).not.toHaveBeenCalled();
    });
  });
});
