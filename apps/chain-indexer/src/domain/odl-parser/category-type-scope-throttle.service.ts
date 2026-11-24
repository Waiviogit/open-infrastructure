import { Injectable, Logger } from '@nestjs/common';
import { RedisClientFactory } from '@opden-data-layer/clients';

import { CATEGORY_TYPE_SCOPE_MIN_INTERVAL_SEC } from '../../constants/object-categories.constants';
import { redisKey } from '../../constants/redis-keys';

/**
 * Rate limit for type category scope rebuilds: one rebuild per type per
 * {@link CATEGORY_TYPE_SCOPE_MIN_INTERVAL_SEC}. A Redis key with that TTL marks a recent rebuild.
 * Redis failures fail open (the scope is rebuilt), so a Redis outage never blocks the queue.
 */
@Injectable()
export class CategoryTypeScopeThrottleService {
  private readonly logger = new Logger(CategoryTypeScopeThrottleService.name);

  constructor(private readonly redisFactory: RedisClientFactory) {}

  /** Types among `objectTypes` rebuilt less than the interval ago. */
  async throttledTypes(objectTypes: readonly string[]): Promise<string[]> {
    const redis = this.redisFactory.getClient();
    const throttled: string[] = [];
    for (const type of objectTypes) {
      try {
        if (await redis.exists(redisKey.categoryTypeScopeThrottle(type))) {
          throttled.push(type);
        }
      } catch (e) {
        this.logger.warn(`category type scope throttle read failed: ${(e as Error).message}`);
      }
    }
    return throttled;
  }

  async markRebuilt(objectType: string): Promise<void> {
    try {
      await this.redisFactory
        .getClient()
        .set(
          redisKey.categoryTypeScopeThrottle(objectType),
          String(Date.now()),
          CATEGORY_TYPE_SCOPE_MIN_INTERVAL_SEC,
        );
    } catch (e) {
      this.logger.warn(`category type scope throttle write failed: ${(e as Error).message}`);
    }
  }
}
