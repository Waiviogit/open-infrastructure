import { sharedRedisKey } from '@opden-data-layer/core';

import { AccountMetadataUpdatedEvent } from './account-metadata-updated.event';
import { QueryApiAccountCacheInvalidator } from './query-api-account-cache-invalidator';

describe('QueryApiAccountCacheInvalidator', () => {
  const del = jest.fn();
  const redisFactory = { getClient: jest.fn(() => ({ del })) };
  let invalidator: QueryApiAccountCacheInvalidator;

  beforeEach(() => {
    jest.clearAllMocks();
    invalidator = new QueryApiAccountCacheInvalidator(redisFactory as never);
  });

  it("deletes query-api's cached live account", async () => {
    del.mockResolvedValue(undefined);

    await invalidator.onAccountMetadataUpdated(new AccountMetadataUpdatedEvent('Flowmaster'));

    expect(redisFactory.getClient).toHaveBeenCalledWith(0);
    expect(del).toHaveBeenCalledWith('query-api:cache:hive:account:flowmaster');
    expect(sharedRedisKey.queryApiHiveAccount('Flowmaster')).toBe(
      'query-api:cache:hive:account:flowmaster',
    );
  });

  it('does not fail indexing when Redis is down', async () => {
    del.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      invalidator.onAccountMetadataUpdated(new AccountMetadataUpdatedEvent('flowmaster')),
    ).resolves.toBeUndefined();
  });
});
