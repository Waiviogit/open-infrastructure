import { SUPPORTED_CURRENCIES } from '@opden-data-layer/core';
import { isHiveAccountName, normalizeHiveAccountInput } from '@opden-data-layer/common';
import { z } from 'zod';

import {
  HUB_FEED_CURSOR_MAX_LENGTH,
  HUB_FEED_DEFAULT_LIMIT,
  HUB_FEED_MAX_LIMIT,
} from '../hub-feed.constants';

const OBJECT_ID_MAX_LENGTH = 256;

const sortFilter = <K extends 'trending' | 'hot' | 'new'>(kind: K) =>
  z.object({ kind: z.literal(kind) }).describe(`Site-wide feed, sort "${kind}"`);

const myFilter = z
  .object({ kind: z.literal('my') })
  .describe("Viewer's feed: followed accounts plus followed, favorited and owned objects (needs X-Viewer)");

const authorFilter = z
  .object({
    kind: z.literal('author'),
    account: z
      .string()
      .transform(normalizeHiveAccountInput)
      .refine(isHiveAccountName, 'Invalid Hive account name')
      .describe('Hive account whose items to show'),
  })
  .describe('One account');

const objectFilter = z
  .object({
    kind: z.literal('object'),
    object_id: z.string().trim().min(1).max(OBJECT_ID_MAX_LENGTH).describe('Object id'),
  })
  .describe('One object');

const pageFields = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(HUB_FEED_MAX_LIMIT)
    .optional()
    .default(HUB_FEED_DEFAULT_LIMIT)
    .describe('Page size'),
  cursor: z
    .string()
    .max(HUB_FEED_CURSOR_MAX_LENGTH)
    .optional()
    .describe('Opaque cursor from the previous page of the same filter'),
};

const withEmptyBody = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((data) => (data === undefined || data === null ? {} : data), schema);

export const hubPostsFeedBodyFieldsSchema = z.object({
  ...pageFields,
  currency: z.enum(SUPPORTED_CURRENCIES).optional().default('USD').describe('Reward display currency'),
  filter: z
    .discriminatedUnion('kind', [
      sortFilter('trending'),
      sortFilter('hot'),
      sortFilter('new'),
      myFilter,
      authorFilter,
      objectFilter,
    ])
    .optional()
    .default({ kind: 'new' }),
});
export const hubPostsFeedBodySchema = withEmptyBody(hubPostsFeedBodyFieldsSchema);
export type HubPostsFeedBody = z.infer<typeof hubPostsFeedBodyFieldsSchema>;

export const hubThreadsFeedBodyFieldsSchema = z.object({
  ...pageFields,
  filter: z
    .discriminatedUnion('kind', [
      sortFilter('trending'),
      sortFilter('hot'),
      sortFilter('new'),
      myFilter,
      authorFilter,
      objectFilter,
    ])
    .optional()
    .default({ kind: 'new' }),
});
export const hubThreadsFeedBodySchema = withEmptyBody(hubThreadsFeedBodyFieldsSchema);
export type HubThreadsFeedBody = z.infer<typeof hubThreadsFeedBodyFieldsSchema>;

/** Activity messages have no votes or comments: only time-ordered filters. */
export const hubActivityFeedBodyFieldsSchema = z.object({
  ...pageFields,
  filter: z
    .discriminatedUnion('kind', [sortFilter('new'), myFilter, authorFilter, objectFilter])
    .optional()
    .default({ kind: 'new' }),
});
export const hubActivityFeedBodySchema = withEmptyBody(hubActivityFeedBodyFieldsSchema);
export type HubActivityFeedBody = z.infer<typeof hubActivityFeedBodyFieldsSchema>;

/** Object updates have a rank score but no comments: no "hot". */
export const hubUpdatesFeedBodyFieldsSchema = z.object({
  ...pageFields,
  filter: z
    .discriminatedUnion('kind', [
      sortFilter('trending'),
      sortFilter('new'),
      myFilter,
      authorFilter,
      objectFilter,
    ])
    .optional()
    .default({ kind: 'new' }),
});
export const hubUpdatesFeedBodySchema = withEmptyBody(hubUpdatesFeedBodyFieldsSchema);
export type HubUpdatesFeedBody = z.infer<typeof hubUpdatesFeedBodyFieldsSchema>;
