import { isUserFavoritesObjectType } from '@opden-data-layer/core';
import { z } from 'zod';
import { countryQueryField } from '../../http/country-query.schema';

const MAX_PAGE = 50;
const DEFAULT_PAGE = 20;

export const userFavoritesQuerySchema = z.object({
  objectType: z
    .string()
    .min(1)
    .optional()
    .describe('Filter by object_type; types outside USER_FAVORITES_OBJECT_TYPES yield an empty page'),
  skip: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Offset for pagination'),
  limit: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_PAGE)
    .optional()
    .default(DEFAULT_PAGE)
    .describe('Page size'),
  country: countryQueryField,
});

export type UserFavoritesQuery = z.infer<typeof userFavoritesQuerySchema>;

export const userFavoritesTypeItemSchema = z.object({
  object_type: z.string(),
  objects_count: z.number().int().nonnegative(),
  supports_categories: z
    .boolean()
    .describe('True when the type supports the category update (category navigation)'),
  has_categories: z
    .boolean()
    .describe(
      'True when the category root of this type lists at least one category (same navigation as the categories endpoint); clients show category navigation only then',
    ),
});

export type UserFavoritesTypeItem = z.infer<typeof userFavoritesTypeItemSchema>;

export const userFavoritesTypesResponseSchema = z.object({
  types: z.array(z.string()).describe('Object types in scope, count DESC then type ASC'),
  items: z.array(userFavoritesTypeItemSchema).describe('Same order as types, with counts'),
});

export type UserFavoritesTypesResponse = z.infer<typeof userFavoritesTypesResponseSchema>;

/** Normalizes a repeatable `types` query value (string | string[]) to trimmed non-empty strings. */
export function normalizeTypesQueryValue(v: unknown): string[] {
  if (v === undefined || v === null || v === '') {
    return [];
  }
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  return [String(v).trim()].filter(Boolean);
}

/** Repeatable `types`: at least one, every entry in `USER_FAVORITES_OBJECT_TYPES` (else 400). */
export const userFavoritesTypesParam = z.preprocess(
  normalizeTypesQueryValue,
  z
    .array(z.string())
    .min(1, { message: 'types is required' })
    .refine((types) => types.every((type) => isUserFavoritesObjectType(type)), {
      message: 'every types entry must be a Favorites object type (USER_FAVORITES_OBJECT_TYPES)',
    }),
);
