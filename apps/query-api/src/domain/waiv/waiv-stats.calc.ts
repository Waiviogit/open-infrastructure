import { WAIV_TOKENOMICS } from '@opden-data-layer/core';

import type { WaivAccountCounts, WaivStatsResponse } from './schemas/waiv.schema';

export type WaivStatsInput = {
  circulatingSupply: string;
  totalStaked: string | undefined;
  /** `amountPerDay` of every active development-fund proposal. */
  proposalAmountsPerDay: readonly string[];
  priceUsd: number | null;
  priceHive: number | null;
  accounts: WaivAccountCounts;
  now: Date;
};

function toAmount(raw: string | undefined): number {
  const parsed = Number.parseFloat(raw ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function usdOrNull(amount: number, priceUsd: number | null): number | null {
  return priceUsd === null ? null : amount * priceUsd;
}

/** Assembles the WAIV page stats from Hive Engine token data, fund proposals and the stored rate. */
export function computeWaivStats(input: WaivStatsInput): WaivStatsResponse {
  const circulating = toAmount(input.circulatingSupply);
  const staked = Math.min(toAmount(input.totalStaked), circulating);

  const requestedPerDay = input.proposalAmountsPerDay.reduce(
    (sum, amount) => sum + toAmount(amount),
    0,
  );
  const maxPerDay = WAIV_TOKENOMICS.DEVELOPMENT_FUND_MAX_WAIV_PER_DAY;
  const days = WAIV_TOKENOMICS.DEVELOPMENT_FUND_DAYS_PER_MONTH;
  const availablePerMonthWaiv = maxPerDay * days;
  const distributedPerMonthWaiv = Math.min(requestedPerDay, maxPerDay) * days;

  return {
    priceUsd: input.priceUsd,
    priceHive: input.priceHive,
    supply: { circulating, staked, liquid: circulating - staked },
    marketCapUsd: usdOrNull(circulating, input.priceUsd),
    annualInflationPercent: WAIV_TOKENOMICS.ANNUAL_INFLATION_PERCENT,
    inflationDistribution: { ...WAIV_TOKENOMICS.INFLATION_DISTRIBUTION_PERCENT },
    rewardsPool: { ...WAIV_TOKENOMICS.REWARDS_POOL_PERCENT },
    developmentFund: {
      availablePerMonthWaiv,
      distributedPerMonthWaiv,
      availablePerMonthUsd: usdOrNull(availablePerMonthWaiv, input.priceUsd),
      distributedPerMonthUsd: usdOrNull(distributedPerMonthWaiv, input.priceUsd),
    },
    accounts: input.accounts,
    updatedAt: input.now.toISOString(),
  };
}

/** A stored rate of 0 or below means "no price yet". */
export function positiveRateOrNull(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
}
