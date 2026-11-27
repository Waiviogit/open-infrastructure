import { computeWaivStats, positiveRateOrNull, type WaivStatsInput } from './waiv-stats.calc';

const baseInput: WaivStatsInput = {
  circulatingSupply: '12121406.25915392',
  totalStaked: '7029337.22860107',
  proposalAmountsPerDay: ['100', '50.5'],
  priceUsd: 0.0066,
  priceHive: 0.18,
  accounts: { holders: 114689, monthlyActive: 7203 },
  now: new Date('2026-11-27T12:00:00.000Z'),
};

describe('computeWaivStats', () => {
  it('derives liquid supply and market cap from circulating supply and price', () => {
    const stats = computeWaivStats(baseInput);
    expect(stats.supply.circulating).toBeCloseTo(12121406.25915392, 6);
    expect(stats.supply.staked).toBeCloseTo(7029337.22860107, 6);
    expect(stats.supply.liquid).toBeCloseTo(5092069.03055285, 6);
    expect(stats.marketCapUsd).toBeCloseTo(12121406.25915392 * 0.0066, 6);
    expect(stats.updatedAt).toBe('2026-11-27T12:00:00.000Z');
  });

  it('caps the distributed development fund at 137 WAIV per day over 30 days', () => {
    const stats = computeWaivStats(baseInput);
    expect(stats.developmentFund.availablePerMonthWaiv).toBe(4110);
    expect(stats.developmentFund.distributedPerMonthWaiv).toBe(4110);
    expect(stats.developmentFund.availablePerMonthUsd).toBeCloseTo(4110 * 0.0066, 9);
  });

  it('distributes the requested amount when it is under the cap', () => {
    const stats = computeWaivStats({ ...baseInput, proposalAmountsPerDay: ['20', 'oops', '-5'] });
    expect(stats.developmentFund.distributedPerMonthWaiv).toBe(600);
  });

  it('keeps USD fields null without a price', () => {
    const stats = computeWaivStats({ ...baseInput, priceUsd: null });
    expect(stats.marketCapUsd).toBeNull();
    expect(stats.developmentFund.availablePerMonthUsd).toBeNull();
    expect(stats.developmentFund.distributedPerMonthUsd).toBeNull();
  });

  it('never reports more staked than circulating', () => {
    const stats = computeWaivStats({ ...baseInput, totalStaked: '99999999' });
    expect(stats.supply.liquid).toBe(0);
  });

  it('returns the published tokenomics', () => {
    const stats = computeWaivStats(baseInput);
    expect(stats.annualInflationPercent).toBe(4.73);
    expect(stats.inflationDistribution).toEqual({
      rewardsPool: 80,
      developmentFund: 10,
      liquidityProviders: 10,
    });
    expect(stats.rewardsPool).toEqual({ authors: 50, curators: 50 });
  });
});

describe('positiveRateOrNull', () => {
  it.each([
    [0.0066, 0.0066],
    [0, null],
    [undefined, null],
    [Number.NaN, null],
  ])('%p → %p', (input, expected) => {
    expect(positiveRateOrNull(input)).toBe(expected);
  });
});
