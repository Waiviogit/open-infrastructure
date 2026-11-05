import { UPDATE_TYPES } from '@opden-data-layer/core/update-types';

import type { PlaceDetails } from '@/modules/editor/domain/place.schema';

import { buildEditorQuickCreateOps } from './build-editor-quick-create-ops';
import { buildPlaceObjectFields, preparePlaceQuickCreate } from './build-place-object-fields';

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    place_id: 'ChIJabc',
    name: 'Cafe Kyiv',
    formatted_address: '12 Main St, Kyiv 01001, Ukraine',
    latitude: 50.45,
    longitude: 30.52,
    primary_type: 'cafe',
    suggested_object_type: 'restaurant',
    existing_object_id: null,
    address: {
      street: '12 Main St',
      locality: 'Kyiv',
      state: 'Kyiv City',
      postal_code: '01001',
      country: 'Ukraine',
    },
    phone: '+380 44 000 0000',
    website: 'https://cafe.example',
    work_hours: ['Monday: 9 AM – 5 PM', 'Tuesday: Closed'],
    photo_uri: 'https://lh3.googleusercontent.com/p1',
    maps_uri: 'https://maps.google.com/?cid=1',
    ...overrides,
  };
}

function valueOf(fields: ReturnType<typeof buildPlaceObjectFields>, type: string): unknown {
  return fields.find((f) => f.updateType === type)?.value;
}

describe('buildPlaceObjectFields', () => {
  it('maps a Google place to name, identifier, address, geo, contacts, hours and image', () => {
    const fields = buildPlaceObjectFields({ details: details(), locale: 'en-US', imageCid: CID });

    expect(valueOf(fields, UPDATE_TYPES.NAME)).toBe('Cafe Kyiv');
    expect(valueOf(fields, UPDATE_TYPES.IDENTIFIER)).toEqual({
      type: 'googleMaps',
      value: 'ChIJabc',
    });
    expect(valueOf(fields, UPDATE_TYPES.ADDRESS)).toEqual({
      street: '12 Main St',
      locality: 'Kyiv',
      state: 'Kyiv City',
      postal_code: '01001',
      country: 'Ukraine',
    });
    expect(valueOf(fields, UPDATE_TYPES.GEO)).toEqual({ latitude: 50.45, longitude: 30.52 });
    expect(valueOf(fields, UPDATE_TYPES.TELEPHONE)).toEqual({ value: '+380 44 000 0000' });
    expect(valueOf(fields, UPDATE_TYPES.WEBSITE)).toEqual({
      title: 'Cafe Kyiv',
      link: 'https://cafe.example',
    });
    expect(valueOf(fields, UPDATE_TYPES.WORK_HOURS)).toBe('Monday: 9 AM – 5 PM\nTuesday: Closed');
    expect(valueOf(fields, UPDATE_TYPES.IMAGE)).toEqual({ cid: CID });
    expect(fields.every((f) => f.locale === 'en-US')).toBe(true);
  });

  it('drops an address without postal code but keeps the other fields', () => {
    const fields = buildPlaceObjectFields({
      details: details({
        address: { street: '1 Road', locality: 'Town', state: null, postal_code: null, country: 'UA' },
      }),
      locale: 'en-US',
      imageCid: null,
    });

    const types = fields.map((f) => f.updateType);
    expect(types).not.toContain(UPDATE_TYPES.ADDRESS);
    expect(types).toEqual(
      expect.arrayContaining([UPDATE_TYPES.NAME, UPDATE_TYPES.GEO, UPDATE_TYPES.IDENTIFIER]),
    );
  });

  it('creates without image when there is no uploaded photo', () => {
    const fields = buildPlaceObjectFields({ details: details(), locale: 'en-US', imageCid: null });

    expect(fields.map((f) => f.updateType)).not.toContain(UPDATE_TYPES.IMAGE);
    expect(valueOf(fields, UPDATE_TYPES.IDENTIFIER)).toEqual({ type: 'googleMaps', value: 'ChIJabc' });
  });

  it('drops a website that is not a URL', () => {
    const fields = buildPlaceObjectFields({
      details: details({ website: 'not a url' }),
      locale: 'en-US',
      imageCid: null,
    });

    expect(fields.map((f) => f.updateType)).not.toContain(UPDATE_TYPES.WEBSITE);
  });

  it('omits geo when Google returned no coordinates', () => {
    const fields = buildPlaceObjectFields({
      details: details({ latitude: null, longitude: null }),
      locale: 'en-US',
      imageCid: null,
    });

    expect(fields.map((f) => f.updateType)).not.toContain(UPDATE_TYPES.GEO);
  });
});

describe('creating an object from a place', () => {
  it('broadcasts only custom_json signed by the user, with the googleMaps identifier', () => {
    const { objectId, fields } = preparePlaceQuickCreate(
      { details: details(), locale: 'en-US', imageCid: CID, objectType: 'restaurant' },
      'abc',
    );

    const ops = buildEditorQuickCreateOps({
      objectId,
      objectType: 'restaurant',
      creator: 'alice',
      odlCustomJsonId: 'odl-testnet',
      fields,
      language: 'en-US',
    });

    expect(objectId).toBe('abc-cafe-kyiv');
    expect(ops.map((op) => op.type)).toEqual(ops.map(() => 'custom_json'));
    expect(ops.map((op) => op.required_posting_auths)).toEqual(ops.map(() => ['alice']));

    const events = ops.flatMap(
      (op) => (JSON.parse(op.json) as { events: { action: string; payload: Record<string, unknown> }[] }).events,
    );
    expect(events[0]).toMatchObject({
      action: 'object_create',
      payload: { object_id: 'abc-cafe-kyiv', object_type: 'restaurant' },
    });
    expect(events.map((e) => e.action)).not.toContain('batch_import');
    expect(
      events.find((e) => e.payload.update_type === UPDATE_TYPES.IDENTIFIER)?.payload.value_json,
    ).toEqual({ type: 'googleMaps', value: 'ChIJabc' });
  });

  it('keeps restaurant seed fields and does not duplicate the name', () => {
    const { fields } = preparePlaceQuickCreate(
      { details: details(), locale: 'en-US', imageCid: null, objectType: 'restaurant' },
      'abc',
    );

    expect(fields.filter((f) => f.updateType === UPDATE_TYPES.NAME)).toHaveLength(1);
    expect(fields.some((f) => f.updateType === UPDATE_TYPES.AGGREGATE_RATING)).toBe(true);
  });
});
