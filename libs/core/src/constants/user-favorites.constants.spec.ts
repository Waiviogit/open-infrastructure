import { CATEGORY_OBJECT_TYPES } from '../object-type-registry/category-object-types';
import { buildUserCategoryScopeKey, parseUserCategoryScopeKey } from './category-tree.constants';
import {
  getPostLinkedHideFlagKey,
  isUserFavoritesObjectType,
  resolvePostLinkedObjectTypes,
  USER_FAVORITES_EXCLUDED_TYPES,
  USER_FAVORITES_OBJECT_TYPES,
} from './user-favorites.constants';

describe('USER_FAVORITES_OBJECT_TYPES', () => {
  it('contains every category type', () => {
    for (const type of CATEGORY_OBJECT_TYPES) {
      expect(isUserFavoritesObjectType(type)).toBe(true);
    }
  });

  it('keeps legacy favorites types and drops excluded ones', () => {
    expect(USER_FAVORITES_OBJECT_TYPES).toContain('restaurant');
    expect(USER_FAVORITES_OBJECT_TYPES).toContain('list');
    for (const type of USER_FAVORITES_EXCLUDED_TYPES) {
      expect(isUserFavoritesObjectType(type)).toBe(false);
    }
  });
});

describe('getPostLinkedHideFlagKey', () => {
  it.each([
    ['book', 'hide_linked_objects'],
    ['product', 'hide_linked_objects'],
    ['recipe', 'hide_recipe_objects'],
    ['restaurant', 'hide_favorite_objects'],
    ['service', 'hide_favorite_objects'],
  ])('%s → %s', (type, flag) => {
    expect(getPostLinkedHideFlagKey(type)).toBe(flag);
  });
});

describe('resolvePostLinkedObjectTypes', () => {
  const types = ['book', 'recipe', 'restaurant'];

  it('includes every type without flags', () => {
    expect(resolvePostLinkedObjectTypes(types, null)).toEqual(types);
  });

  it('drops types hidden by their flag', () => {
    expect(
      resolvePostLinkedObjectTypes(types, {
        hide_linked_objects: false,
        hide_recipe_objects: true,
        hide_favorite_objects: true,
      }),
    ).toEqual(['book']);
  });
});

describe('user category scope keys', () => {
  it('round-trips account and type', () => {
    const key = buildUserCategoryScopeKey(' alice ', 'recipe');
    expect(key).toBe('alice:recipe');
    expect(parseUserCategoryScopeKey(key)).toEqual({ account: 'alice', objectType: 'recipe' });
  });

  it.each(['alice', 'alice:book,product', 'alice:restaurant', ':recipe'])(
    'returns null for legacy or invalid key %s',
    (key) => {
      expect(parseUserCategoryScopeKey(key)).toBeNull();
    },
  );
});
