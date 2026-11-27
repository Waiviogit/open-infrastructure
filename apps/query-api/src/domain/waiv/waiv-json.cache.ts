import { Injectable, Logger } from '@nestjs/common';
import { RedisClientFactory } from '@opden-data-layer/clients';
import type { z } from 'zod';

/**
 * Read-through JSON cache for the WAIV page. Cached values are re-validated with `schema`;
 * Redis errors only log a warning and fall back to `load`.
 */
@Injectable()
export class WaivJsonCache {
  private readonly logger = new Logger(WaivJsonCache.name);

  constructor(private readonly redisFactory: RedisClientFactory) {}

  async getOrLoad<T>(params: {
    key: string;
    ttlSec: number;
    schema: z.ZodType<T>;
    load: () => Promise<T>;
    /** Skip writing results that should be retried soon (e.g. an unavailable upstream). */
    shouldCache?: (value: T) => boolean;
  }): Promise<T> {
    const redis = this.redisFactory.getClient(0);
    const cached = await this.read(redis, params.key, params.schema);
    if (cached !== null) {
      return cached;
    }

    const value = await params.load();
    if (params.shouldCache && !params.shouldCache(value)) {
      return value;
    }
    try {
      await redis.set(params.key, JSON.stringify(value), params.ttlSec);
    } catch (e) {
      this.logger.warn(`waiv cache write failed: ${(e as Error).message}`);
    }
    return value;
  }

  private async read<T>(
    redis: ReturnType<RedisClientFactory['getClient']>,
    key: string,
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (e) {
      this.logger.warn(`waiv cache read failed: ${(e as Error).message}`);
      return null;
    }
  }
}
