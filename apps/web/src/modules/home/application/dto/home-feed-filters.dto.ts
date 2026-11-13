import { z } from 'zod';

import { projectedObjectViewSchema } from '@/modules/feed/application/dto/feed-story.dto';

const countSchema = z.number().int().nullable();

export const homeFeedFilterUserSchema = z.object({
  name: z.string(),
  avatarUrl: z.string().nullable(),
  count: countSchema,
});

export const homeFeedFilterObjectSchema = z.object({
  objectId: z.string(),
  objectType: z.string(),
  count: countSchema,
  object: projectedObjectViewSchema.nullable(),
});

export const homeFeedFilterUsersPageSchema = z.object({
  items: z.array(homeFeedFilterUserSchema),
  hasMore: z.boolean(),
});

export const homeFeedFilterObjectsPageSchema = z.object({
  items: z.array(homeFeedFilterObjectSchema),
  hasMore: z.boolean(),
});

/** `GET /query/v1/users/:name/feed-filters` */
export const homeFeedFiltersResponseSchema = z.object({
  tab: z.enum(['posts', 'threads', 'activity', 'updates']),
  windowHours: z.number().int(),
  windowStart: z.number().int(),
  countsAvailable: z.boolean(),
  users: homeFeedFilterUsersPageSchema.extend({ total: z.number().int() }),
  objectTypes: z.array(
    z.object({
      objectType: z.string(),
      count: countSchema,
      total: z.number().int(),
      objects: homeFeedFilterObjectsPageSchema,
    }),
  ),
});

export type HomeFeedFilterUser = z.infer<typeof homeFeedFilterUserSchema>;
export type HomeFeedFilterObject = z.infer<typeof homeFeedFilterObjectSchema>;
export type HomeFeedFilterUsersPage = z.infer<typeof homeFeedFilterUsersPageSchema>;
export type HomeFeedFilterObjectsPage = z.infer<typeof homeFeedFilterObjectsPageSchema>;
export type HomeFeedFiltersView = z.infer<typeof homeFeedFiltersResponseSchema>;
export type HomeFeedFilterTypeView = HomeFeedFiltersView['objectTypes'][number];
