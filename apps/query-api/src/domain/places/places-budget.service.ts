import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { RedisClientFactory } from '@opden-data-layer/clients';

import { redisKey } from '../../constants/redis-keys';
import {
  PLACES_RATE_LIMIT_PER_MIN,
  PLACES_RATE_LIMIT_WINDOW_SEC,
} from './places.constants';

const RATE_COUNTER_FIELD = 'count';
const MS_PER_SEC = 1000;
const UNKNOWN_CLIENT = 'unknown';

export class PlacesRateLimitedError extends Error {
  constructor() {
    super('places_rate_limited');
    this.name = 'PlacesRateLimitedError';
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Protects the Google Places budget: Redis response cache plus a fixed-window
 * per-IP counter that is consumed only when a request is about to reach Google.
 * Redis failures never block the feature (cache miss / limit not enforced).
 */
@Injectable()
export class PlacesBudgetService {
  private readonly logger = new Logger(PlacesBudgetService.name);

  constructor(private readonly redisFactory: RedisClientFactory) {}

  /** Throws {@link PlacesRateLimitedError} when the client exceeded the per-minute budget. */
  async consumeGoogleCall(clientIp: string | null, nowMs: number = Date.now()): Promise<void> {
    const windowMs = PLACES_RATE_LIMIT_WINDOW_SEC * MS_PER_SEC;
    const bucket = Math.floor(nowMs / windowMs);
    const key = redisKey.placesRateLimit(sha256Hex(clientIp ?? UNKNOWN_CLIENT), bucket);
    let count: number;
    try {
      const client = this.redisFactory.getClient(0);
      await client.hIncrBy(key, RATE_COUNTER_FIELD, 1);
      await client.expire(key, PLACES_RATE_LIMIT_WINDOW_SEC);
      count = Number((await client.hGet(key, RATE_COUNTER_FIELD)) ?? 0);
    } catch (e) {
      this.logger.error((e as Error).message);
      return;
    }
    if (count > PLACES_RATE_LIMIT_PER_MIN) {
      throw new PlacesRateLimitedError();
    }
  }

  async readJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redisFactory.getClient(0).get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (e) {
      this.logger.error((e as Error).message);
      return null;
    }
  }

  async writeJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    try {
      await this.redisFactory.getClient(0).set(key, JSON.stringify(value), ttlSec);
    } catch (e) {
      this.logger.error((e as Error).message);
    }
  }
}
