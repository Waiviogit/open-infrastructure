import { z } from 'zod';

import { categoryNavItemSchema } from '@/shared/domain/category-nav';

import { socialProjectedObjectSchema } from '@/modules/user-social/application/dto/user-social.dto';

export const discoverObjectsPageSchema = z.object({
  items: z.array(socialProjectedObjectSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type DiscoverObjectsPage = z.infer<typeof discoverObjectsPageSchema>;

export const discoverUserRowSchema = z.object({
  name: z.string(),
  profile_image: z.string().nullable(),
  reputation: z.number(),
  wobjects_weight: z.number().nullish().default(0),
  followers_count: z.number(),
  is_following: z.boolean(),
});

export const discoverUsersPageSchema = z.object({
  items: z.array(discoverUserRowSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type DiscoverUsersPage = z.infer<typeof discoverUsersPageSchema>;

export const discoverTagCategoryItemSchema = z.object({
  value: z.string(),
  count: z.number(),
});

export const discoverTagCategoriesResponseSchema = z.object({
  categories: z.array(
    z.object({
      category: z.string(),
      items: z.array(discoverTagCategoryItemSchema),
    }),
  ),
});

export type DiscoverTagCategoriesResponse = z.infer<typeof discoverTagCategoriesResponseSchema>;

/** `GET /query/v1/discover/categories`: one level of a type's category tree. */
export const discoverCategoriesResponseSchema = z.object({
  items: z.array(categoryNavItemSchema),
  show_other: z.boolean(),
  /** Groups of the level in none of `items` (the Other category); 0 at the type root. */
  other_count: z.number().int().nonnegative().default(0),
});

export type DiscoverCategoriesResponse = z.infer<typeof discoverCategoriesResponseSchema>;

/** One category block: a child category with its preview objects and group count. */
export const discoverSectionSchema = z.object({
  categoryName: z.string(),
  items: z.array(socialProjectedObjectSchema),
  totalObjects: z.number(),
});

/** The Other block: groups of the category in none of its children. */
export const discoverOtherSectionSchema = z.object({
  items: z.array(socialProjectedObjectSchema),
  totalObjects: z.number(),
});

/** `GET /query/v1/discover/sections`: one page of category blocks. */
export const discoverSectionsPageSchema = z.object({
  sections: z.array(discoverSectionSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
  /** Last page only. */
  other: discoverOtherSectionSchema.nullable().default(null),
});

export type DiscoverOtherSection = z.infer<typeof discoverOtherSectionSchema>;

export type DiscoverSection = z.infer<typeof discoverSectionSchema>;
export type DiscoverSectionsPage = z.infer<typeof discoverSectionsPageSchema>;
