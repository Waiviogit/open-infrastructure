import { z } from 'zod';

import { HUB_FEED_TABS } from '../hub-feed-filter';
import {
  HUB_FEED_FILTERS_MAX_PAGE_SIZE,
  HUB_FEED_FILTERS_PAGE_SIZE,
} from '../hub-feed.constants';

const OBJECT_TYPE_MAX_LENGTH = 64;

const tab = z.enum(HUB_FEED_TABS).describe('Hub tab whose items are counted');

const pageSize = z.coerce
  .number()
  .int()
  .min(0)
  .max(HUB_FEED_FILTERS_MAX_PAGE_SIZE)
  .optional()
  .default(HUB_FEED_FILTERS_PAGE_SIZE);

const skip = z.coerce.number().int().min(0).optional().default(0).describe('Rows to skip');

/** GET /users/:name/feed-filters */
export const hubFeedFiltersQuerySchema = z.object({
  tab,
  users_limit: pageSize.describe('Followed accounts to return'),
  objects_limit: pageSize.describe('Followed objects to return per object type'),
});
export type HubFeedFiltersQuery = z.infer<typeof hubFeedFiltersQuerySchema>;

/** GET /users/:name/feed-filters/users */
export const hubFeedFilterUsersQuerySchema = z.object({
  tab,
  skip,
  limit: pageSize.describe('Page size'),
});
export type HubFeedFilterUsersQuery = z.infer<typeof hubFeedFilterUsersQuerySchema>;

/** GET /users/:name/feed-filters/objects */
export const hubFeedFilterObjectsQuerySchema = z.object({
  tab,
  object_type: z.string().trim().min(1).max(OBJECT_TYPE_MAX_LENGTH).describe('Object type section'),
  skip,
  limit: pageSize.describe('Page size'),
});
export type HubFeedFilterObjectsQuery = z.infer<typeof hubFeedFilterObjectsQuerySchema>;
