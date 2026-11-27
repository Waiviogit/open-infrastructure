export const WAIV_CHART_PERIODS = ['1d', '7d', '1m', '3m', '6m', '1y', '2y', 'all'] as const;

export type WaivChartPeriod = (typeof WAIV_CHART_PERIODS)[number];

export const WAIV_CHART_DEFAULT_PERIOD: WaivChartPeriod = '1m';

/** `1d` and `7d` plot intraday samples; the rest plot one point per day. */
export function isIntradayPeriod(period: WaivChartPeriod): boolean {
  return period === '1d' || period === '7d';
}

export function isWaivChartPeriod(value: string): value is WaivChartPeriod {
  return (WAIV_CHART_PERIODS as readonly string[]).includes(value);
}

export type WaivChartPoint = {
  /** Epoch milliseconds (UTC). */
  time: number;
  usd: number;
  hive: number;
};

export type WaivChart = {
  period: WaivChartPeriod;
  /** Oldest first. */
  points: WaivChartPoint[];
  changeUsdPercent: number;
  /** Latest point (the stored head rate). */
  latest: WaivChartPoint | null;
};

export type WaivStats = {
  priceUsd: number | null;
  priceHive: number | null;
  supply: { circulating: number; staked: number; liquid: number };
  marketCapUsd: number | null;
  annualInflationPercent: number;
  inflationDistribution: {
    rewardsPool: number;
    developmentFund: number;
    liquidityProviders: number;
  };
  rewardsPool: { authors: number; curators: number };
  developmentFund: {
    availablePerMonthWaiv: number;
    distributedPerMonthWaiv: number;
    availablePerMonthUsd: number | null;
    distributedPerMonthUsd: number | null;
  };
  accounts: { holders: number | null; monthlyActive: number | null };
  updatedAt: string;
};

export type WaivSwap = {
  id: string;
  account: string;
  avatarUrl: string | null;
  transactionId: string;
  blockNumber: number;
  timestamp: string;
  symbolIn: string;
  symbolInQuantity: string;
  symbolOut: string;
  symbolOutQuantity: string;
};

export type WaivSwapsPage = {
  items: WaivSwap[];
  cursor: string | null;
  hasMore: boolean;
};
