/** Update types resolved before projecting any profile Favorites card (list, sections, map). */
export const USER_FAVORITES_CARD_UPDATE_TYPES = [
  'name',
  'image',
  'parent',
  'price',
  'brand',
  'description',
  'tagCategoryItem',
  'aggregateRating',
  'title',
  'address',
  'identifier',
] as const;

/** Favorites map list/markers also need geo coordinates. */
export const USER_FAVORITES_MAP_UPDATE_TYPES = [...USER_FAVORITES_CARD_UPDATE_TYPES, 'geo'] as const;
