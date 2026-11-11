import { objectTypeSupportsCategories } from '@opden-data-layer/core';
import { z } from 'zod';
import { normalizeTypesQueryValue } from '../favorites/favorites.schema';

const qsArray = z.preprocess((v: unknown) => {
  if (v === undefined || v === '') {
    return [];
  }
  if (Array.isArray(v)) {
    return v.map((x) => String(x));
  }
  return [String(v)];
}, z.array(z.string()));

export { qsArray };

/** `types`: exactly one object type from `CATEGORY_OBJECT_TYPES` (no default; else 400). */
export const categoryObjectTypeParam = z.preprocess(
  normalizeTypesQueryValue,
  z.array(z.string()).refine(
    (types) => types.length === 1 && objectTypeSupportsCategories(types[0] ?? ''),
    { message: 'types must be exactly one category object type (CATEGORY_OBJECT_TYPES)' },
  ),
);

export const userCategoriesQuerySchema = z.object({
  types: categoryObjectTypeParam.describe(
    'Exactly one category object type (CATEGORY_OBJECT_TYPES), e.g. recipe or book',
  ),
  name: z.string().optional().describe('Parent department for level ≥ 2 (omit at root)'),
  path: qsArray.describe('Ancestor category names when drilling down'),
  excluded: qsArray.describe('Sibling names to exclude (client hint)'),
});

export type UserCategoriesQuery = z.infer<typeof userCategoriesQuerySchema>;

export type UserCategoryNavItem = { name: string; objects_count: number; has_children: boolean };

export type UserCategoriesResponse = {
  items: UserCategoryNavItem[];
  uncategorized_count: number;
  show_other: boolean;
};
