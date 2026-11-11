import { z } from 'zod';

export const categoryNavItemSchema = z.object({
  name: z.string(),
  objects_count: z.number(),
  has_children: z.boolean(),
});

/** `GET /query/v1/users/:name/categories` (one category type per request). */
export const categoryNavDataSchema = z.object({
  items: z.array(categoryNavItemSchema),
  uncategorized_count: z.number(),
  show_other: z.boolean(),
});

export type CategoryNavItem = z.infer<typeof categoryNavItemSchema>;

export type CategoryNavData = z.infer<typeof categoryNavDataSchema>;
