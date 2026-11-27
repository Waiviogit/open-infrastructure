import {
  HiveEngineUnavailableError,
  type EngineStatisticClient,
  type HiveEngineClient,
  type RedisClientFactory,
} from '@opden-data-layer/clients';
import type { CurrencyQueryService } from '@opden-data-layer/currency';

import { GetWaivStatsEndpoint } from './get-waiv-stats.endpoint';
import { WaivJsonCache } from './waiv-json.cache';
import { WaivStatsUnavailableError } from './waiv.errors';

function setup(overrides: {
  token?: () => Promise<unknown>;
  proposals?: () => Promise<unknown[]>;
  holders?: number | null;
}) {
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
  const hiveEngine = {
    findOneStrict: jest.fn(
      overrides.token ??
        (async () => ({ circulatingSupply: '1000', totalStaked: '400' })),
    ),
    findStrict: jest.fn(overrides.proposals ?? (async () => [{ amountPerDay: '10' }, { foo: 1 }])),
  };
  const engineStatistic = {
    getTokenHolderCount: jest.fn().mockResolvedValue(
      overrides.holders === undefined ? 114689 : overrides.holders,
    ),
    getTokenMonthlyActiveUserCount: jest.fn().mockResolvedValue(7203),
  };
  const currency = {
    engineLatestStored: jest.fn().mockResolvedValue({ HIVE: 0.18, USD: 0.01 }),
  };
  const endpoint = new GetWaivStatsEndpoint(
    hiveEngine as unknown as HiveEngineClient,
    engineStatistic as unknown as EngineStatisticClient,
    currency as unknown as CurrencyQueryService,
    new WaivJsonCache({ getClient: () => redis } as unknown as RedisClientFactory),
  );
  return { endpoint, redis, hiveEngine, engineStatistic, store };
}

describe('GetWaivStatsEndpoint', () => {
  it('assembles stats from Hive Engine, the stored rate and engine-statistic', async () => {
    const { endpoint, hiveEngine } = setup({});
    const stats = await endpoint.execute();

    expect(hiveEngine.findOneStrict).toHaveBeenCalledWith({
      contract: 'tokens',
      table: 'tokens',
      query: { symbol: 'WAIV' },
    });
    expect(stats).toMatchObject({
      priceUsd: 0.01,
      priceHive: 0.18,
      supply: { circulating: 1000, staked: 400, liquid: 600 },
      marketCapUsd: 10,
      developmentFund: { distributedPerMonthWaiv: 300 },
      accounts: { holders: 114689, monthlyActive: 7203 },
    });
  });

  it('serves the second call from the cache', async () => {
    const { endpoint, hiveEngine } = setup({});
    await endpoint.execute();
    await endpoint.execute();
    expect(hiveEngine.findOneStrict).toHaveBeenCalledTimes(1);
  });

  it('does not cache account counts the legacy service failed to return', async () => {
    const { endpoint, store } = setup({ holders: null });
    const stats = await endpoint.execute();
    expect(stats.accounts.holders).toBeNull();
    expect([...store.keys()].some((key) => key.includes('account-counts'))).toBe(false);
  });

  it('maps a Hive Engine outage to WaivStatsUnavailableError and caches nothing', async () => {
    const { endpoint, redis } = setup({
      token: async () => {
        throw new HiveEngineUnavailableError();
      },
    });
    await expect(endpoint.execute()).rejects.toBeInstanceOf(WaivStatsUnavailableError);
    expect(redis.set).not.toHaveBeenCalledWith(
      expect.stringContaining(':stats:'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('treats a missing token as unavailable', async () => {
    const { endpoint } = setup({ token: async () => null });
    await expect(endpoint.execute()).rejects.toBeInstanceOf(WaivStatsUnavailableError);
  });
});
