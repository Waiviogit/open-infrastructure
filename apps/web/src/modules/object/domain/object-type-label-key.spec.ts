import { objectTypeLabelKey } from './object-type-label-key';

describe('objectTypeLabelKey', () => {
  it('returns the catalog key of a named object type', () => {
    expect(objectTypeLabelKey('restaurant')).toBe('object_type_restaurant');
    expect(objectTypeLabelKey('service_offer')).toBe(
      'object_type_service_offer',
    );
  });

  it('drops ampersands before the lookup', () => {
    expect(objectTypeLabelKey('re&staurant')).toBe('object_type_restaurant');
  });

  it('returns null when the catalog has no name for the type', () => {
    expect(objectTypeLabelKey('unknown_type')).toBeNull();
    expect(objectTypeLabelKey('')).toBeNull();
  });
});
