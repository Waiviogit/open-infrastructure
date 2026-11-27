import { UPDATE_TYPES } from '../update-registry/update-types';
import { CATEGORY_OBJECT_TYPES, objectTypeSupportsCategories } from './category-object-types';
import { OBJECT_TYPE_REGISTRY } from './object-type-registry';

describe('CATEGORY_OBJECT_TYPES', () => {
  it('lists the registry types that support the category update', () => {
    expect(CATEGORY_OBJECT_TYPES).toEqual([
      'book',
      'business',
      'link',
      'person',
      'product',
      'recipe',
      'restaurant',
      'service',
      'service_offer',
      'service_request',
    ]);
  });

  it('matches supported_updates for every registry entry', () => {
    for (const definition of Object.values(OBJECT_TYPE_REGISTRY)) {
      expect(objectTypeSupportsCategories(definition.object_type)).toBe(
        definition.supported_updates.includes(UPDATE_TYPES.CATEGORY),
      );
    }
  });

  it('rejects unknown types', () => {
    expect(objectTypeSupportsCategories('dish')).toBe(false);
    expect(objectTypeSupportsCategories('')).toBe(false);
  });
});
