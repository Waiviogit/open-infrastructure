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
});

export type DiscoverCategoriesResponse = z.infer<typeof discoverCategoriesResponseSchema>;

/** One category block: a child category with its preview objects and group count. */
export const discoverSectionSchema = z.object({
  categoryName: z.string(),
  items: z.array(socialProjectedObjectSchema),
  totalObjects: z.number(),
});

/** `GET /query/v1/discover/sections`: one page of category blocks. */
export const discoverSectionsPageSchema = z.object({
  sections: z.array(discoverSectionSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type DiscoverSection = z.infer<typeof discoverSectionSchema>;
export type DiscoverSectionsPage = z.infer<typeof discoverSectionsPageSchema>;
