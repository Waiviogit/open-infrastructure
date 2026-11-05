import { mapAddressComponents, suggestObjectTypeForGoogleTypes } from './google-place.mapper';

describe('suggestObjectTypeForGoogleTypes', () => {
  it.each([
    [['restaurant', 'food', 'point_of_interest'], 'restaurant'],
    [['park', 'tourist_attraction'], 'place'],
    [['store', 'point_of_interest'], 'business'],
    [[], 'business'],
  ])('maps %j to %s', (types, expected) => {
    expect(suggestObjectTypeForGoogleTypes(types)).toBe(expected);
  });

  it('prefers restaurant when a place is both food and a landmark', () => {
    expect(suggestObjectTypeForGoogleTypes(['tourist_attraction', 'cafe'])).toBe('restaurant');
  });

  it('treats a missing type list as business', () => {
    expect(suggestObjectTypeForGoogleTypes(undefined)).toBe('business');
  });
});

describe('mapAddressComponents', () => {
  const component = (longText: string, ...types: string[]) => ({ longText, types });

  it('builds street, locality, state, postal code and country from Google parts', () => {
    expect(
      mapAddressComponents([
        component('12', 'street_number'),
        component('Main St', 'route'),
        component('Kyiv', 'locality', 'political'),
        component('Kyiv City', 'administrative_area_level_1', 'political'),
        component('01001', 'postal_code'),
        component('Ukraine', 'country', 'political'),
      ]),
    ).toEqual({
      street: '12 Main St',
      locality: 'Kyiv',
      state: 'Kyiv City',
      postal_code: '01001',
      country: 'Ukraine',
    });
  });

  it('uses the route alone when there is no street number', () => {
    expect(mapAddressComponents([component('Main St', 'route')])?.street).toBe('Main St');
  });

  it('falls back to postal_town when locality is missing', () => {
    expect(
      mapAddressComponents([component('London', 'postal_town'), component('UK', 'country')])
        ?.locality,
    ).toBe('London');
  });

  it('leaves absent parts null instead of inventing values', () => {
    expect(mapAddressComponents([component('Ukraine', 'country')])).toEqual({
      street: null,
      locality: null,
      state: null,
      postal_code: null,
      country: 'Ukraine',
    });
  });

  it('returns null when Google sent no components', () => {
    expect(mapAddressComponents([])).toBeNull();
    expect(mapAddressComponents(undefined)).toBeNull();
  });
});
