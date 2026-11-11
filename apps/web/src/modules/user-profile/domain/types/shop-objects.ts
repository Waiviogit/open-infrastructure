import { z } from 'zod';

import { projectedObjectViewSchema } from '@/modules/feed/application/dto/feed-story.dto';

export const shopObjectsPageSchema = z.object({
  items: z.array(projectedObjectViewSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type ShopObjectsPage = z.infer<typeof shopObjectsPageSchema>;

export const shopSectionViewSchema = z.object({
  categoryName: z.string(),
  items: z.array(projectedObjectViewSchema),
  totalObjects: z.number(),
});

export type ShopSectionView = z.infer<typeof shopSectionViewSchema>;

export const shopSectionsPageSchema = z.object({
  sections: z.array(shopSectionViewSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type ShopSectionsPage = z.infer<typeof shopSectionsPageSchema>;

/** Stable error code of Favorites feed pagination (mapped to i18n in client components). */
export type FavoritesFeedError = 'service_unavailable';

/** Objects per Favorites list page. */
export const FAVORITES_OBJECTS_PAGE_SIZE = 20;

/** Preview cards per category section (matches query-api `SHOP_SECTION_OBJECTS_PER_CATEGORY`). */
export const FAVORITES_SECTION_PREVIEW_LIMIT = 3;
