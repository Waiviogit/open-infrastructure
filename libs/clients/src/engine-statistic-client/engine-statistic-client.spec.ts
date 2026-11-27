import { EngineStatisticClient, parseCountBody } from './engine-statistic-client';

describe('parseCountBody', () => {
  it('reads a non-negative result', () => {
    expect(parseCountBody({ result: 114689 })).toBe(114689);
  });

  it.each([null, {}, { result: '12' }, { result: -1 }, { result: Number.NaN }])(
    'returns null for %p',
    (body) => {
      expect(parseCountBody(body)).toBeNull();
    },
  );
});

describe('EngineStatisticClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests the lower-case token path and returns the count', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 7203 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = new EngineStatisticClient({ baseUrl: 'https://stats.example/engine-statistic/' });

    await expect(client.getTokenMonthlyActiveUserCount('WAIV')).resolves.toBe(7203);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://stats.example/engine-statistic/waiv/active-users',
    );
  });

  it('returns null on HTTP errors and network failures', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockRejectedValueOnce(new Error('timeout')) as unknown as typeof fetch;
    const client = new EngineStatisticClient({});

    await expect(client.getTokenHolderCount('WAIV')).resolves.toBeNull();
    await expect(client.getTokenHolderCount('WAIV')).resolves.toBeNull();
  });
});
