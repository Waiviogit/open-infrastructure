import { z } from 'zod';

const favoritesTypeItemSchema = z.object({
  object_type: z.string(),
  objects_count: z.number(),
  supports_categories: z.boolean(),
  /** Supports categories and at least one object of the type has one. */
  has_categories: z.boolean(),
});

/**
 * `GET /query/v1/users/:name/favorites/types`. `items` (count desc) is additive; older
 * query-api builds return `types` only.
 * @see docs/apps/query-api/spec/users-favorites-endpoint.md
 */
export const favoritesTypesResponseSchema = z.object({
  types: z.array(z.string()),
  items: z.array(favoritesTypeItemSchema).optional(),
});

export type FavoritesTypesResponse = z.infer<typeof favoritesTypesResponseSchema>;

/** One entry of the Favorites type rail; `objectsCount` is null when the API omits counts. */
export type FavoritesTypeSummary = {
  objectType: string;
  objectsCount: number | null;
  /** Show category navigation (accordion, chips, sections) only when true. */
  hasCategories: boolean;
};

export type FavoritesTypesView = {
  types: string[];
  items: FavoritesTypeSummary[];
};

export function toFavoritesTypesView(response: FavoritesTypesResponse): FavoritesTypesView {
  if (response.items && response.items.length > 0) {
    return {
      types: response.items.map((item) => item.object_type),
      items: response.items.map((item) => ({
        objectType: item.object_type,
        objectsCount: item.objects_count,
        hasCategories: item.has_categories,
      })),
    };
  }
  return {
    types: response.types,
    items: response.types.map((objectType) => ({
      objectType,
      objectsCount: null,
      hasCategories: false,
    })),
  };
}

export const EMPTY_FAVORITES_TYPES_VIEW: FavoritesTypesView = { types: [], items: [] };

/** True when the type has categorized objects, so category navigation is shown for it. */
export function favoritesTypeHasCategories(
  items: readonly FavoritesTypeSummary[],
  objectType: string,
): boolean {
  return items.some((item) => item.objectType === objectType && item.hasCategories);
}
