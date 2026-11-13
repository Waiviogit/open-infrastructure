import { Injectable, Logger } from '@nestjs/common';
import { RedisClientFactory } from '@opden-data-layer/clients';

import { HUB_FEED_FILTER_COUNTS_CACHE_TTL_SEC } from '../../constants/cache.constants';
import { redisKey } from '../../constants/redis-keys';
import { HubFeedFilterCountsRepository } from '../../repositories';
import type { HubFeedTab } from './hub-feed-filter';
import {
  buildHubFeedFilterSnapshot,
  hubFeedCounterWindowStart,
  type HubFeedFilterSnapshot,
} from './hub-feed-filter-snapshot';
import {
  HUB_FEED_FILTER_COUNTS_TIMEOUT_MS,
  HUB_FEED_FILTERS_MAX_FOLLOWS,
} from './hub-feed.constants';
import { nowUnixSec } from './hub-feed-window';

/**
 * Sorted rail snapshot per (account, tab), cached in Redis. When counting exceeds its
 * time budget the rail still gets the follow list, without numbers, and nothing is cached.
 * @see docs/apps/query-api/spec/hub-feed-filters.md
 */
@Injectable()
export class HubFeedFilterSnapshotService {
  private readonly logger = new Logger(HubFeedFilterSnapshotService.name);

  constructor(
    private readonly countsRepo: HubFeedFilterCountsRepository,
    private readonly redisFactory: RedisClientFactory,
  ) {}

  async getSnapshot(account: string, tab: HubFeedTab): Promise<HubFeedFilterSnapshot> {
    const key = redisKey.hubFeedFilterCounts(account, tab);
    const cached = await this.readCache(key);
    if (cached) {
      return cached;
    }

    const query = {
      account,
      tab,
      sinceHour: hubFeedCounterWindowStart(nowUnixSec()),
      maxFollows: HUB_FEED_FILTERS_MAX_FOLLOWS,
    };
    const counted = await this.countsRepo.findFollowsWithCounts(query, HUB_FEED_FILTER_COUNTS_TIMEOUT_MS);
    if (!counted) {
      const follows = await this.countsRepo.findFollows(query);
      return buildHubFeedFilterSnapshot(follows, query.sinceHour, false);
    }

    const snapshot = buildHubFeedFilterSnapshot(counted, query.sinceHour, true);
    await this.writeCache(key, snapshot);
    return snapshot;
  }

  private async readCache(key: string): Promise<HubFeedFilterSnapshot | null> {
    try {
      const raw = await this.redisFactory.getClient(0).get(key);
      return raw ? (JSON.parse(raw) as HubFeedFilterSnapshot) : null;
    } catch (error) {
      this.logger.warn(`hub feed filters cache unreadable for ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  private async writeCache(key: string, snapshot: HubFeedFilterSnapshot): Promise<void> {
    try {
      await this.redisFactory
        .getClient(0)
        .set(key, JSON.stringify(snapshot), HUB_FEED_FILTER_COUNTS_CACHE_TTL_SEC);
    } catch (error) {
      this.logger.warn(`hub feed filters cache write failed for ${key}: ${(error as Error).message}`);
    }
  }
}
