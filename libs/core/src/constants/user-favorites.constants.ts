import { CATEGORY_OBJECT_TYPES } from '../object-type-registry/category-object-types';
import { FAVORITES_OBJECT_TYPES } from './favorites.constants';

/** Types never shown in the profile Favorites tab even when linked from posts. */
export const USER_FAVORITES_EXCLUDED_TYPES: readonly string[] = ['hashtag', 'governance'];

/**
 * Object types eligible for the profile Favorites tab: legacy favorites types plus every
 * registry type that supports `category`, minus {@link USER_FAVORITES_EXCLUDED_TYPES}.
 */
export const USER_FAVORITES_OBJECT_TYPES: readonly string[] = [
  ...new Set<string>([...FAVORITES_OBJECT_TYPES, ...CATEGORY_OBJECT_TYPES]),
]
  .filter((type) => !USER_FAVORITES_EXCLUDED_TYPES.includes(type))
  .sort();

const USER_FAVORITES_OBJECT_TYPE_SET: ReadonlySet<string> = new Set(USER_FAVORITES_OBJECT_TYPES);

export function isUserFavoritesObjectType(objectType: string): boolean {
  return USER_FAVORITES_OBJECT_TYPE_SET.has(objectType.trim());
}

/** `user_metadata` flags that hide post-linked objects from the Favorites scope. */
export type UserFavoritesVisibilityFlags = {
  hide_linked_objects: boolean;
  hide_recipe_objects: boolean;
  hide_favorite_objects: boolean;
};

export type PostLinkedHideFlagKey = keyof UserFavoritesVisibilityFlags;

const LINKED_OBJECTS_FLAG_TYPES: ReadonlySet<string> = new Set(['book', 'product']);
const RECIPE_OBJECTS_FLAG_TYPES: ReadonlySet<string> = new Set(['recipe']);

/**
 * Which `user_metadata` flag hides post-linked objects of this type.
 * book/product → `hide_linked_objects` (legacy shop), recipe → `hide_recipe_objects`,
 * every other type → `hide_favorite_objects`.
 */
export function getPostLinkedHideFlagKey(objectType: string): PostLinkedHideFlagKey {
  const type = objectType.trim();
  if (LINKED_OBJECTS_FLAG_TYPES.has(type)) {
    return 'hide_linked_objects';
  }
  if (RECIPE_OBJECTS_FLAG_TYPES.has(type)) {
    return 'hide_recipe_objects';
  }
  return 'hide_favorite_objects';
}

/** Types (subset of `types`) whose post-linked objects are included for these flags. */
export function resolvePostLinkedObjectTypes(
  types: readonly string[],
  flags: UserFavoritesVisibilityFlags | null | undefined,
): string[] {
  if (!flags) {
    return [...types];
  }
  return types.filter((type) => !flags[getPostLinkedHideFlagKey(type)]);
}
