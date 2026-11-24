import { z } from 'zod';

import { categoryNavItemSchema } from '@/shared/domain/category-nav';

export { categoryNavItemSchema };

/** `GET /query/v1/users/:name/categories` (one category type per request). */
export const categoryNavDataSchema = z.object({
  items: z.array(categoryNavItemSchema),
  uncategorized_count: z.number(),
  show_other: z.boolean(),
});

export type { CategoryNavItem } from '@/shared/domain/category-nav';

export type CategoryNavData = z.infer<typeof categoryNavDataSchema>;
