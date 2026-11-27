import { z } from 'zod';

/** `GET /query/v1/currency/engine/chart` — points newest first. */
export const waivChartApiSchema = z.object({
  result: z.array(
    z.object({
      dateString: z.string(),
      timestamp: z.string().optional(),
      rates: z.object({ HIVE: z.number(), USD: z.number() }),
    }),
  ),
  change: z.object({ HIVE: z.number(), USD: z.number() }),
  lowUSD: z.number(),
  highUSD: z.number(),
});

export type WaivChartApiResponse = z.infer<typeof waivChartApiSchema>;

/** `GET /query/v1/waiv/stats`. */
export const waivStatsApiSchema = z.object({
  priceUsd: z.number().nullable(),
  priceHive: z.number().nullable(),
  supply: z.object({ circulating: z.number(), staked: z.number(), liquid: z.number() }),
  marketCapUsd: z.number().nullable(),
  annualInflationPercent: z.number(),
  inflationDistribution: z.object({
    rewardsPool: z.number(),
    developmentFund: z.number(),
    liquidityProviders: z.number(),
  }),
  rewardsPool: z.object({ authors: z.number(), curators: z.number() }),
  developmentFund: z.object({
    availablePerMonthWaiv: z.number(),
    distributedPerMonthWaiv: z.number(),
    availablePerMonthUsd: z.number().nullable(),
    distributedPerMonthUsd: z.number().nullable(),
  }),
  accounts: z.object({ holders: z.number().nullable(), monthlyActive: z.number().nullable() }),
  updatedAt: z.string(),
});

export const waivSwapApiSchema = z.object({
  id: z.string(),
  account: z.string(),
  avatarUrl: z.string().nullable(),
  transactionId: z.string(),
  blockNumber: z.number(),
  timestamp: z.string(),
  symbolIn: z.string(),
  symbolInQuantity: z.string(),
  symbolOut: z.string(),
  symbolOutQuantity: z.string(),
});

/** `GET /query/v1/waiv/swaps`. */
export const waivSwapsPageApiSchema = z.object({
  items: z.array(waivSwapApiSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

/** BFF chart payload (already mapped, oldest first). */
export const waivChartViewSchema = z.object({
  period: z.enum(['1d', '7d', '1m', '3m', '6m', '1y', '2y', 'all']),
  points: z.array(z.object({ time: z.number(), usd: z.number(), hive: z.number() })),
  changeUsdPercent: z.number(),
  latest: z.object({ time: z.number(), usd: z.number(), hive: z.number() }).nullable(),
});
