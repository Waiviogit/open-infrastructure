import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisClientFactory } from '@opden-data-layer/clients';
import { sharedRedisKey } from '@opden-data-layer/core';

import {
  ACCOUNT_METADATA_UPDATED_EVENT,
  AccountMetadataUpdatedEvent,
} from './account-metadata-updated.event';

/**
 * Drops query-api's cached live account so the profile and sidebar read the new metadata as soon as
 * the update is indexed (the web refreshes after the trx confirmation, which comes after this).
 */
@Injectable()
export class QueryApiAccountCacheInvalidator {
  private readonly logger = new Logger(QueryApiAccountCacheInvalidator.name);

  constructor(private readonly redisFactory: RedisClientFactory) {}

  @OnEvent(ACCOUNT_METADATA_UPDATED_EVENT, { promisify: true })
  async onAccountMetadataUpdated(event: AccountMetadataUpdatedEvent): Promise<void> {
    try {
      await this.redisFactory.getClient(0).del(sharedRedisKey.queryApiHiveAccount(event.account));
    } catch (e) {
      // The cache entry still expires on its own TTL; indexing must not fail on it.
      this.logger.warn(`query-api account cache not cleared for ${event.account}: ${(e as Error).message}`);
    }
  }
}
