/** Hive Engine WAIV token reward pool (comments contract). */
export const WAIV_TOKEN = {
  SYMBOL: 'WAIV',
  REWARD_POOL_ID: 13,
  DIESEL_POOL_ID: 63,
  /** Hive Engine `marketpools` pair of the WAIV/HIVE pool (`DIESEL_POOL_ID`). */
  HIVE_POOL_SYMBOLS: ['WAIV', 'SWAP.HIVE'],
  /** `tokenfunds` fund that pays WAIV development proposals. */
  DEVELOPMENT_FUND_ID: 'WAIV:WAIV',
} as const;

/**
 * WAIV tokenomics published by the token issuer (fixed at token launch, not on chain).
 * Percent values are whole percents.
 */
export const WAIV_TOKENOMICS = {
  ANNUAL_INFLATION_PERCENT: 4.73,
  INFLATION_DISTRIBUTION_PERCENT: {
    rewardsPool: 80,
    developmentFund: 10,
    liquidityProviders: 10,
  },
  REWARDS_POOL_PERCENT: {
    authors: 50,
    curators: 50,
  },
  /** Development fund pays at most this many WAIV per day across active proposals. */
  DEVELOPMENT_FUND_MAX_WAIV_PER_DAY: 137,
  DEVELOPMENT_FUND_DAYS_PER_MONTH: 30,
} as const;
