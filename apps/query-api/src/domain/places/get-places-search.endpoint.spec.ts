import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { RedisClientFactory } from '@opden-data-layer/clients';

import type { ObjectIdentifiersRepository } from '../../repositories/object-identifiers.repository';
import type { GeoipLookupService } from '../geoip/geoip-lookup.service';
import { GetPlacesSearchEndpoint } from './get-places-search.endpoint';
import { GooglePlacesClient } from './google-places.client';
import { PlacesBudgetService, PlacesRateLimitedError } from './places-budget.service';
import { PLACES_RATE_LIMIT_PER_MIN } from './places.constants';

const GOOGLE_BASE = 'https://places.test/v1';

type FakeRedis = {
  store: Map<string, string>;
  counters: Map<string, number>;
};

function fakeRedisFactory(state: FakeRedis): RedisClientFactory {
  const client = {
    get: async (key: string) => state.store.get(key) ?? null,
    set: async (key: string, value: string) => {
      state.store.set(key, value);
    },
    hIncrBy: async (key: string, _field: string, by: number) => {
      state.counters.set(key, (state.counters.get(key) ?? 0) + by);
    },
    hGet: async (key: string) => String(state.counters.get(key) ?? 0),
    expire: async () => undefined,
  };
  return { getClient: () => client } as unknown as RedisClientFactory;
}

function config(apiKey: string | undefined): ConfigService {
  const values: Record<string, unknown> = {
    'googlePlaces.apiKey': apiKey,
    'googlePlaces.baseUrl': GOOGLE_BASE,
    'googlePlaces.requestTimeoutMs': 1000,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function geoip(lookup: { latitude: number | null; longitude: number | null } | null) {
  return {
    lookup: () =>
      lookup && { countryCode: 'UA', accuracyRadiusKm: 20, ...lookup },
  } as unknown as GeoipLookupService;
}

function identifiers(existing: Record<string, string>): ObjectIdentifiersRepository {
  return {
    findObjectIdsByIdentifier: async (type: string, values: readonly string[]) => {
      const map = new Map<string, string>();
      if (type !== 'googleMaps') {
        return map;
      }
      for (const value of values) {
        if (existing[value]) {
          map.set(value, existing[value]);
        }
      }
      return map;
    },
  } as unknown as ObjectIdentifiersRepository;
}

function googlePlace(id: string, name: string) {
  return {
    id,
    displayName: { text: name },
    formattedAddress: `${name} street`,
    location: { latitude: 50.45, longitude: 30.52 },
    types: ['restaurant'],
    primaryType: 'restaurant',
  };
}

describe('GetPlacesSearchEndpoint', () => {
  let fetchMock: jest.SpyInstance;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = { store: new Map(), counters: new Map() };
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  function googleResponds(places: unknown[], status = 200): void {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ places }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  function build(options: {
    apiKey?: string;
    geo?: { latitude: number | null; longitude: number | null } | null;
    existing?: Record<string, string>;
  }): GetPlacesSearchEndpoint {
    return new GetPlacesSearchEndpoint(
      new GooglePlacesClient(config('apiKey' in options ? options.apiKey : 'key')),
      geoip(options.geo === undefined ? { latitude: 50.45, longitude: 30.52 } : options.geo),
      new PlacesBudgetService(fakeRedisFactory(redis)),
      identifiers(options.existing ?? {}),
    );
  }

  const input = { q: 'pizza', limit: 5, locale: 'en-US', clientIp: '1.2.3.4' };

  function sentBody(): Record<string, unknown> {
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  }

  it('marks places already linked to an object with existing_object_id', async () => {
    googleResponds([googlePlace('ChIJabc', 'Cafe A'), googlePlace('ChIJxyz', 'Cafe B')]);
    const result = await build({ existing: { ChIJabc: 'abc-cafe' } }).execute(input);

    expect(result.enabled).toBe(true);
    expect(result.places.map((p) => [p.place_id, p.existing_object_id])).toEqual([
      ['ChIJabc', 'abc-cafe'],
      ['ChIJxyz', null],
    ]);
    expect(result.places[0]?.suggested_object_type).toBe('restaurant');
  });

  it('biases the Google search to the caller IP location within 50 km', async () => {
    googleResponds([]);
    await build({}).execute(input);

    expect(sentBody().locationBias).toEqual({
      circle: { center: { latitude: 50.45, longitude: 30.52 }, radius: 50_000 },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${GOOGLE_BASE}/places:searchText`);
  });

  it('searches without bias when GeoIP has no coordinates', async () => {
    googleResponds([googlePlace('ChIJabc', 'Cafe A')]);
    const result = await build({ geo: null }).execute(input);

    expect(sentBody()).not.toHaveProperty('locationBias');
    expect(result.places).toHaveLength(1);
  });

  it('reports disabled and never calls Google without an API key', async () => {
    const result = await build({ apiKey: undefined }).execute(input);

    expect(result).toEqual({ enabled: false, places: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a client over the per-minute budget without calling Google', async () => {
    googleResponds([]);
    const endpoint = build({});
    for (let i = 0; i < PLACES_RATE_LIMIT_PER_MIN; i += 1) {
      await endpoint.execute({ ...input, q: `pizza ${i}` });
    }
    fetchMock.mockClear();

    await expect(endpoint.execute({ ...input, q: 'pizza over' })).rejects.toBeInstanceOf(
      PlacesRateLimitedError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no places when Google fails', async () => {
    googleResponds([], 500);
    const result = await build({}).execute(input);

    expect(result).toEqual({ enabled: true, places: [] });
  });

  it('logs the reason Google gives for a 403 and returns no places', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 403,
            status: 'PERMISSION_DENIED',
            message: 'Requests from this IP address are blocked.',
            details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_IP_ADDRESS_BLOCKED' }],
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await build({}).execute(input);

    expect(result).toEqual({ enabled: true, places: [] });
    expect(warn).toHaveBeenCalledWith(
      'Google Places HTTP 403: PERMISSION_DENIED / API_KEY_IP_ADDRESS_BLOCKED / Requests from this IP address are blocked.',
    );
    warn.mockRestore();
  });

  it('returns no places when the Google request throws (timeout)', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));
    const result = await build({}).execute(input);

    expect(result).toEqual({ enabled: true, places: [] });
  });

  it('drops malformed places and keeps valid ones', async () => {
    googleResponds([{ displayName: { text: 'No id' } }, googlePlace('ChIJok', 'Valid')]);
    const result = await build({}).execute(input);

    expect(result.places.map((p) => p.place_id)).toEqual(['ChIJok']);
  });

  it('serves a repeated query from cache without calling Google again', async () => {
    googleResponds([googlePlace('ChIJabc', 'Cafe A')]);
    const endpoint = build({});
    await endpoint.execute(input);
    fetchMock.mockClear();

    const second = await endpoint.execute(input);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.places.map((p) => p.place_id)).toEqual(['ChIJabc']);
  });

  it('recomputes existing_object_id for cached results', async () => {
    googleResponds([googlePlace('ChIJabc', 'Cafe A')]);
    await build({}).execute(input);

    const later = await build({ existing: { ChIJabc: 'abc-cafe' } }).execute(input);

    expect(later.places[0]?.existing_object_id).toBe('abc-cafe');
  });

  it('does not call Google for queries shorter than 3 characters', async () => {
    const result = await build({}).execute({ ...input, q: 'pi' });

    expect(result).toEqual({ enabled: true, places: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
