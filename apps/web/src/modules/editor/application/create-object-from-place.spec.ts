import type { CustomJsonOp } from '@opden-data-layer/hive-broadcast';

import type { PlaceDetails } from '../domain/place.schema';
import {
  createObjectFromPlace,
  type CreateObjectFromPlacePorts,
} from './create-object-from-place';

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    place_id: 'ChIJabc',
    name: 'Cafe Kyiv',
    formatted_address: null,
    latitude: 50.45,
    longitude: 30.52,
    primary_type: 'cafe',
    suggested_object_type: 'restaurant',
    existing_object_id: null,
    address: null,
    phone: null,
    website: null,
    work_hours: [],
    photo_uri: 'https://lh3.googleusercontent.com/p1',
    maps_uri: null,
    ...overrides,
  };
}

const INPUT = {
  objectType: 'restaurant' as const,
  locale: 'en-US',
  username: 'alice',
  odlCustomJsonId: 'odl-testnet',
};

function ports(overrides: Partial<CreateObjectFromPlacePorts> = {}) {
  const broadcasts: CustomJsonOp[][] = [];
  const value: CreateObjectFromPlacePorts = {
    findObjectForPlace: async () => ({ status: 'absent' }),
    uploadPhoto: async () => ({ cid: 'bafyphoto', previewUrl: 'https://ipfs/bafyphoto' }),
    objectIdExists: async () => false,
    broadcast: async (operations) => {
      broadcasts.push(operations);
      return { transactionId: 'trx-1' };
    },
    ...overrides,
  };
  return { value, broadcasts };
}

describe('createObjectFromPlace', () => {
  it('reuses the object found by the last-moment place check and does not broadcast', async () => {
    const p = ports({ findObjectForPlace: async () => ({ status: 'found', objectId: 'abc-cafe' }) });

    const result = await createObjectFromPlace({ ...INPUT, details: details() }, p.value);

    expect(result).toEqual({ kind: 'existing', objectId: 'abc-cafe' });
    expect(p.broadcasts).toHaveLength(0);
  });

  it('reuses the object reported in place details without any lookup', async () => {
    const p = ports();

    const result = await createObjectFromPlace(
      { ...INPUT, details: details({ existing_object_id: 'abc-cafe' }) },
      p.value,
    );

    expect(result).toEqual({ kind: 'existing', objectId: 'abc-cafe' });
    expect(p.broadcasts).toHaveLength(0);
  });

  it('refuses to create when the duplicate check is unavailable', async () => {
    const p = ports({ findObjectForPlace: async () => ({ status: 'unknown' }) });

    const result = await createObjectFromPlace({ ...INPUT, details: details() }, p.value);

    expect(result).toEqual({ kind: 'error', code: 'service_unavailable' });
    expect(p.broadcasts).toHaveLength(0);
  });

  it('creates the object with the uploaded photo and the googleMaps identifier', async () => {
    const p = ports();

    const result = await createObjectFromPlace({ ...INPUT, details: details() }, p.value);

    expect(result).toMatchObject({ kind: 'created', transactionId: 'trx-1', imageUrl: 'https://ipfs/bafyphoto' });
    const json = p.broadcasts[0]?.map((op) => op.json).join('\n') ?? '';
    expect(json).toContain('"update_type":"identifier"');
    expect(json).toContain('"value":"ChIJabc"');
    expect(json).toContain('"cid":"bafyphoto"');
  });

  it('still creates the object when the photo upload fails', async () => {
    const p = ports({ uploadPhoto: async () => null });

    const result = await createObjectFromPlace({ ...INPUT, details: details() }, p.value);

    expect(result.kind).toBe('created');
    expect(p.broadcasts[0]?.map((op) => op.json).join('\n')).not.toContain('"update_type":"image"');
  });

  it('tries a new id prefix when the generated id is taken', async () => {
    const checked: string[] = [];
    const p = ports({
      objectIdExists: async (id) => {
        checked.push(id);
        return checked.length === 1;
      },
    });

    const result = await createObjectFromPlace({ ...INPUT, details: details() }, p.value);

    expect(result.kind).toBe('created');
    expect(checked).toHaveLength(2);
    expect(result.kind === 'created' && result.objectId).toBe(checked[1]);
  });

  it('reports a broadcast failure without claiming the object was created', async () => {
    const p = ports({
      broadcast: async () => {
        throw new Error('User rejected');
      },
    });

    const result = await createObjectFromPlace({ ...INPUT, details: details() }, p.value);

    expect(result).toEqual({ kind: 'error', code: 'broadcast_failed', message: 'User rejected' });
  });
});
