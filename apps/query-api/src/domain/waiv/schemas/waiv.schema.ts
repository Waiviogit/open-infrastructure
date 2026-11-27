import { z } from 'zod';

import {
  WAIV_SWAPS_DEFAULT_LIMIT,
  WAIV_SWAPS_MAX_LIMIT,
  WAIV_SWAPS_CURSOR_MAX_LENGTH,
} from '../../../constants/waiv-page.constants';

const percentSchema = z.number().min(0).max(100);

export const waivStatsResponseSchema = z.object({
  priceUsd: z.number().nullable().describe('Latest stored WAIV/USD rate (~5 min)'),
  priceHive: z.number().nullable().describe('Latest stored WAIV/HIVE rate (~5 min)'),
  supply: z.object({
    circulating: z.number().describe('Hive Engine circulatingSupply'),
    staked: z.number().describe('WAIV power (Hive Engine totalStaked)'),
    liquid: z.number().describe('circulating − staked'),
  }),
  marketCapUsd: z.number().nullable().describe('circulating × priceUsd'),
  annualInflationPercent: z.number(),
  inflationDistribution: z.object({
    rewardsPool: percentSchema,
    developmentFund: percentSchema,
    liquidityProviders: percentSchema,
  }),
  rewardsPool: z.object({
    authors: percentSchema,
    curators: percentSchema,
  }),
  developmentFund: z.object({
    availablePerMonthWaiv: z.number(),
    distributedPerMonthWaiv: z.number(),
    availablePerMonthUsd: z.number().nullable(),
    distributedPerMonthUsd: z.number().nullable(),
  }),
  accounts: z.object({
    holders: z.number().int().nullable().describe('Accounts holding WAIV; null when unavailable'),
    monthlyActive: z
      .number()
      .int()
      .nullable()
      .describe('Accounts active with WAIV over the last month; null when unavailable'),
  }),
  updatedAt: z.string().describe('ISO time the stats were assembled'),
});

export type WaivStatsResponse = z.infer<typeof waivStatsResponseSchema>;

export const waivAccountCountsSchema = waivStatsResponseSchema.shape.accounts;

export type WaivAccountCounts = z.infer<typeof waivAccountCountsSchema>;

export const waivSwapsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(WAIV_SWAPS_MAX_LIMIT)
    .default(WAIV_SWAPS_DEFAULT_LIMIT)
    .describe(`Page size (1–${WAIV_SWAPS_MAX_LIMIT})`),
  cursor: z
    .string()
    .min(1)
    .max(WAIV_SWAPS_CURSOR_MAX_LENGTH)
    .optional()
    .describe('Opaque cursor from the previous page'),
});

export type WaivSwapsQuery = z.infer<typeof waivSwapsQuerySchema>;

export const waivSwapItemSchema = z.object({
  id: z.string(),
  account: z.string(),
  avatarUrl: z.string().nullable(),
  transactionId: z.string(),
  blockNumber: z.number().int(),
  timestamp: z.string().describe('ISO block time'),
  symbolIn: z.string().describe('Token the account paid'),
  symbolInQuantity: z.string(),
  symbolOut: z.string().describe('Token the account received'),
  symbolOutQuantity: z.string(),
});

export type WaivSwapItem = z.infer<typeof waivSwapItemSchema>;

export const waivSwapsResponseSchema = z.object({
  items: z.array(waivSwapItemSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type WaivSwapsResponse = z.infer<typeof waivSwapsResponseSchema>;
