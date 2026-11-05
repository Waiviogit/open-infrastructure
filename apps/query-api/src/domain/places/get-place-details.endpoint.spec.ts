import type { ConfigService } from '@nestjs/config';
import type { RedisClientFactory } from '@opden-data-layer/clients';

import type { ObjectIdentifiersRepository } from '../../repositories/object-identifiers.repository';
import { GetPlaceDetailsEndpoint } from './get-place-details.endpoint';
import { GooglePlacesClient } from './google-places.client';
import { PlacesBudgetService } from './places-budget.service';

const GOOGLE_BASE = 'https://places.test/v1';

function redisFactory(): RedisClientFactory {
  const store = new Map<string, string>();
  const client = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
    hIncrBy: async () => undefined,
    hGet: async () => '1',
    expire: async () => undefined,
  };
  return { getClient: () => client } as unknown as RedisClientFactory;
}

const config = {
  get: (key: string) =>
    ({
      'googlePlaces.apiKey': 'key',
      'googlePlaces.baseUrl': GOOGLE_BASE,
      'googlePlaces.requestTimeoutMs': 1000,
    })[key],
} as unknown as ConfigService;

const noExisting = {
  findObjectIdsByIdentifier: async () => new Map<string, string>(),
} as unknown as ObjectIdentifiersRepository;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GetPlaceDetailsEndpoint', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  function endpoint(identifiers = noExisting): GetPlaceDetailsEndpoint {
    return new GetPlaceDetailsEndpoint(
      new GooglePlacesClient(config),
      new PlacesBudgetService(redisFactory()),
      identifiers,
    );
  }

  it('returns contacts, hours, structured address and a resolved photo URL', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          id: 'ChIJabc',
          displayName: { text: 'Cafe A' },
          formattedAddress: '12 Main St, Kyiv',
          addressComponents: [
            { longText: '12', types: ['street_number'] },
            { longText: 'Main St', types: ['route'] },
            { longText: 'Kyiv', types: ['locality'] },
            { longText: '01001', types: ['postal_code'] },
            { longText: 'Ukraine', types: ['country'] },
          ],
          location: { latitude: 50.45, longitude: 30.52 },
          types: ['cafe'],
          internationalPhoneNumber: '+380 44 000 0000',
          websiteUri: 'https://cafe.example',
          regularOpeningHours: { weekdayDescriptions: ['Monday: 9 AM – 5 PM'] },
          photos: [{ name: 'places/ChIJabc/photos/p1' }],
          googleMapsUri: 'https://maps.google.com/?cid=1',
        }),
      )
      .mockResolvedValueOnce(json({ photoUri: 'https://lh3.googleusercontent.com/p1' }));

    const details = await endpoint().execute({
      placeId: 'ChIJabc',
      locale: 'en-US',
      clientIp: '1.2.3.4',
    });

    expect(details).toMatchObject({
      place_id: 'ChIJabc',
      name: 'Cafe A',
      suggested_object_type: 'restaurant',
      address: { street: '12 Main St', locality: 'Kyiv', postal_code: '01001', country: 'Ukraine' },
      phone: '+380 44 000 0000',
      website: 'https://cafe.example',
      work_hours: ['Monday: 9 AM – 5 PM'],
      photo_uri: 'https://lh3.googleusercontent.com/p1',
      existing_object_id: null,
    });
    const photoUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(photoUrl.startsWith(`${GOOGLE_BASE}/places/ChIJabc/photos/p1/media?`)).toBe(true);
    expect(photoUrl).toContain('skipHttpRedirect=true');
    expect(photoUrl).not.toContain('key=');
  });

  it('returns null for a place Google does not know', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 404 } }, 404));

    await expect(
      endpoint().execute({ placeId: 'ChIJmissing', locale: 'en-US', clientIp: null }),
    ).resolves.toBeNull();
  });

  it('reports the object already linked to the place', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'ChIJabc', displayName: { text: 'Cafe A' } }));
    const linked = {
      findObjectIdsByIdentifier: async () => new Map([['ChIJabc', 'abc-cafe']]),
    } as unknown as ObjectIdentifiersRepository;

    const details = await endpoint(linked).execute({
      placeId: 'ChIJabc',
      locale: 'en-US',
      clientIp: null,
    });

    expect(details?.existing_object_id).toBe('abc-cafe');
    expect(details?.photo_uri).toBeNull();
  });
});
