import { Injectable } from '@nestjs/common';
import {
  EngineStatisticClient,
  HiveEngineClient,
  HiveEngineUnavailableError,
  type HiveEngineToken,
} from '@opden-data-layer/clients';
import { WAIV_TOKEN } from '@opden-data-layer/core';
import { CurrencyQueryService } from '@opden-data-layer/currency';
import { z } from 'zod';

import {
  WAIV_ACCOUNT_COUNTS_CACHE_TTL_SEC,
  WAIV_STATS_CACHE_TTL_SEC,
} from '../../constants/cache.constants';
import { redisKey } from '../../constants/redis-keys';
import { WAIV_DEV_FUND_PROPOSALS_LIMIT } from '../../constants/waiv-page.constants';
import {
  waivAccountCountsSchema,
  waivStatsResponseSchema,
  type WaivAccountCounts,
  type WaivStatsResponse,
} from './schemas/waiv.schema';
import { computeWaivStats, positiveRateOrNull } from './waiv-stats.calc';
import { WaivStatsUnavailableError } from './waiv.errors';
import { WaivJsonCache } from './waiv-json.cache';

/** Only the field the stats need; other proposal fields are ignored. */
const devFundProposalSchema = z.object({
  amountPerDay: z.union([z.string(), z.number()]).transform(String),
});

@Injectable()
export class GetWaivStatsEndpoint {
  constructor(
    private readonly hiveEngine: HiveEngineClient,
    private readonly engineStatistic: EngineStatisticClient,
    private readonly currency: CurrencyQueryService,
    private readonly cache: WaivJsonCache,
  ) {}

  /** @throws {WaivStatsUnavailableError} when Hive Engine does not answer. */
  async execute(): Promise<WaivStatsResponse> {
    return this.cache.getOrLoad({
      key: redisKey.waivStats(),
      ttlSec: WAIV_STATS_CACHE_TTL_SEC,
      schema: waivStatsResponseSchema,
      load: () => this.load(),
    });
  }

  private async load(): Promise<WaivStatsResponse> {
    const [token, proposalAmounts, rate, accounts] = await Promise.all([
      this.loadToken(),
      this.loadDevFundProposalAmounts(),
      this.currency.engineLatestStored(WAIV_TOKEN.SYMBOL),
      this.loadAccountCounts(),
    ]);

    return computeWaivStats({
      circulatingSupply: token.circulatingSupply,
      totalStaked: token.totalStaked,
      proposalAmountsPerDay: proposalAmounts,
      priceUsd: positiveRateOrNull(rate?.USD),
      priceHive: positiveRateOrNull(rate?.HIVE),
      accounts,
      now: new Date(),
    });
  }

  private async loadToken(): Promise<HiveEngineToken> {
    const token = await this.strict(() =>
      this.hiveEngine.findOneStrict<HiveEngineToken>({
        contract: 'tokens',
        table: 'tokens',
        query: { symbol: WAIV_TOKEN.SYMBOL },
      }),
    );
    if (!token) {
      throw new WaivStatsUnavailableError();
    }
    return token;
  }

  private async loadDevFundProposalAmounts(): Promise<string[]> {
    const rows = await this.strict(() =>
      this.hiveEngine.findStrict<unknown>({
        contract: 'tokenfunds',
        table: 'proposals',
        query: { fundId: WAIV_TOKEN.DEVELOPMENT_FUND_ID, active: true },
        limit: WAIV_DEV_FUND_PROPOSALS_LIMIT,
      }),
    );
    return rows.flatMap((row) => {
      const parsed = devFundProposalSchema.safeParse(row);
      return parsed.success ? [parsed.data.amountPerDay] : [];
    });
  }

  /** Counts come from a legacy service: cached for an hour, and a miss is retried next request. */
  private loadAccountCounts(): Promise<WaivAccountCounts> {
    return this.cache.getOrLoad({
      key: redisKey.waivAccountCounts(),
      ttlSec: WAIV_ACCOUNT_COUNTS_CACHE_TTL_SEC,
      schema: waivAccountCountsSchema,
      load: async () => {
        const [holders, monthlyActive] = await Promise.all([
          this.engineStatistic.getTokenHolderCount(WAIV_TOKEN.SYMBOL),
          this.engineStatistic.getTokenMonthlyActiveUserCount(WAIV_TOKEN.SYMBOL),
        ]);
        return { holders, monthlyActive };
      },
      shouldCache: (counts) => counts.holders !== null && counts.monthlyActive !== null,
    });
  }

  private async strict<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (e) {
      if (e instanceof HiveEngineUnavailableError) {
        throw new WaivStatsUnavailableError();
      }
      throw e;
    }
  }
}
