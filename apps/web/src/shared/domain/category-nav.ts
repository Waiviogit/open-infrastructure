import { z } from 'zod';

/** One child category of a level (query-api category navigation item; Favorites and Discover). */
export const categoryNavItemSchema = z.object({
  name: z.string(),
  objects_count: z.number(),
  has_children: z.boolean(),
});

export type CategoryNavItem = z.infer<typeof categoryNavItemSchema>;

export function sameCategoryLineage(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}
