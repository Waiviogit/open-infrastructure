import { z } from 'zod';
import { qsArray } from '../categories/categories-query.schema';
import { userFavoritesTypesParam } from '../favorites/favorites.schema';
import { isValidWeightObjectCursor } from '../pagination/weight-object-cursor';
import { countryQueryField } from '../../http/country-query.schema';
import { SHOP_RATING_FILTER_THRESHOLDS } from './shop.constants';

const shopTagsQuery = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .describe('Tag filters as category:value, combined with AND semantics')
  .transform((v) => {
    if (v == null) {
      return [] as string[];
    }
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((s) => s.trim()).filter((s) => s.length > 0);
  });

const shopRatingQuery = z.preprocess(
  (v) => {
    if (v === undefined || v === '' || v === null) {
      return undefined;
    }
    return Number(v);
  },
  z
    .number()
    .refine(
      (n): n is (typeof SHOP_RATING_FILTER_THRESHOLDS)[number] =>
        (SHOP_RATING_FILTER_THRESHOLDS as readonly number[]).includes(n),
      { message: 'rating must be 6, 8, or 10' },
    )
    .optional(),
);

const uncategorizedOnlyQuery = z.preprocess(
  (v) => v === 'true' || v === true || v === '1' || v === 1,
  z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, only objects with no category_names'),
);

const favoritesTypesQuery = userFavoritesTypesParam.describe(
  'Repeatable; every entry must be in USER_FAVORITES_OBJECT_TYPES (Favorites scope)',
);

export const shopObjectsQuerySchema = z.object({
  types: favoritesTypesQuery,
  categoryPath: qsArray.describe(
    'AND filter on category_names path segments; empty = all in scope unless uncategorizedOnly',
  ),
  uncategorizedOnly: uncategorizedOnlyQuery,
  tags: shopTagsQuery,
  rating: shopRatingQuery.describe('Minimum aggregate rating threshold (6, 8, or 10 legacy scale)'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Page size'),
  cursor: z
    .string()
    .optional()
    .refine(isValidWeightObjectCursor, { message: 'cursor is invalid' })
    .describe('Opaque keyset cursor from the previous page (weight + object_id)'),
  country: countryQueryField,
});

export type ShopObjectsQuery = z.infer<typeof shopObjectsQuerySchema>;

export const shopSectionsQuerySchema = z.object({
  types: favoritesTypesQuery.describe(
    'Repeatable; Favorites types. Sections need exactly one category type, otherwise empty',
  ),
  name: z.string().optional().describe('Parent department name for drill-down (omit at root)'),
  path: qsArray.describe('Ancestor category names before name'),
  tags: shopTagsQuery,
  rating: shopRatingQuery,
  cursor: z
    .string()
    .optional()
    .describe('Last category name from previous page (section pagination)'),
  sectionLimit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Max category sections per page'),
  country: countryQueryField,
});

export type ShopSectionsQuery = z.infer<typeof shopSectionsQuerySchema>;

export const shopFiltersQuerySchema = z.object({
  types: favoritesTypesQuery,
  categoryPath: qsArray.describe('Current department path segments'),
  uncategorizedOnly: uncategorizedOnlyQuery,
  tags: shopTagsQuery.describe('Selected tags (AND) to narrow facet counts'),
  rating: shopRatingQuery.describe('Minimum aggregate rating threshold to narrow facet counts'),
});

export type ShopFiltersQuery = z.infer<typeof shopFiltersQuerySchema>;
