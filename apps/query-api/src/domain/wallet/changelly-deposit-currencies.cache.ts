import { Injectable, Logger } from '@nestjs/common';
import { ChangellyClient, RedisClientFactory } from '@opden-data-layer/clients';

import { CHANGELLY_DEPOSIT_CURRENCIES_CACHE_TTL_SEC } from '../../constants/cache.constants';
import { redisKey } from '../../constants/redis-keys';
import { HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN } from './hive-changelly-deposit.constants';
import { buildHiveDepositCurrencies } from './hive-changelly-deposit.mappers';
import {
  hiveChangellyDepositCurrencyListSchema,
  type HiveChangellyDepositCurrency,
} from './schemas/hive-changelly-deposit.schema';

/** Changelly coins that convert into HIVE, cached in Redis. `null` = Changelly unavailable. */
@Injectable()
export class ChangellyDepositCurrenciesCache {
  private readonly logger = new Logger(ChangellyDepositCurrenciesCache.name);

  constructor(
    private readonly changellyClient: ChangellyClient,
    private readonly redisFactory: RedisClientFactory,
  ) {}

  async get(): Promise<HiveChangellyDepositCurrency[] | null> {
    const key = redisKey.changellyDepositCurrencies();
    const cached = await this.readCached(key);
    if (cached) {
      return cached;
    }

    const fresh = await this.fetchFromChangelly();
    if (!fresh) {
      return null;
    }
    await this.writeCached(key, fresh);
    return fresh;
  }

  private async fetchFromChangelly(): Promise<HiveChangellyDepositCurrency[] | null> {
    const [currencies, pairs] = await Promise.all([
      this.changellyClient.getCurrenciesFull(),
      this.changellyClient.getPairs({ to: HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN }),
    ]);
    if (!currencies.result || !pairs.result) {
      return null;
    }
    const list = buildHiveDepositCurrencies(currencies.result, pairs.result);
    if (list.length === 0) {
      this.logger.warn('Changelly returned no coins that convert into HIVE');
      return null;
    }
    return list;
  }

  private async readCached(key: string): Promise<HiveChangellyDepositCurrency[] | null> {
    try {
      const raw = await this.redisFactory.getClient(0).get(key);
      if (!raw) {
        return null;
      }
      const parsed = hiveChangellyDepositCurrencyListSchema.safeParse(JSON.parse(raw));
      return parsed.success && parsed.data.length > 0 ? parsed.data : null;
    } catch (e) {
      this.logger.warn(`Changelly currencies cache read failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCached(
    key: string,
    value: HiveChangellyDepositCurrency[],
  ): Promise<void> {
    try {
      await this.redisFactory
        .getClient(0)
        .set(key, JSON.stringify(value), CHANGELLY_DEPOSIT_CURRENCIES_CACHE_TTL_SEC);
    } catch (e) {
      this.logger.warn(`Changelly currencies cache write failed: ${(e as Error).message}`);
    }
  }
}
