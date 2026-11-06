import { z } from 'zod';

import type { ProjectedObject } from '../../object-projection/projected-object.types';
import type { ObjectUpdateFeedItemDto } from './object-updates-feed.schema';

export const followedObjectsUpdatesFeedBodyFieldsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Page size'),
  cursor: z.string().optional().describe('Opaque pagination cursor from the previous page'),
});

export const followedObjectsUpdatesFeedBodySchema = z.preprocess(
  (data) => (data === undefined || data === null ? {} : data),
  followedObjectsUpdatesFeedBodyFieldsSchema,
);

export type FollowedObjectsUpdatesFeedBody = z.infer<typeof followedObjectsUpdatesFeedBodySchema>;

export type FollowedObjectUpdateFeedItemDto = ObjectUpdateFeedItemDto & {
  /** Light projection (name, avatar, parent) of the object the update belongs to. */
  object: ProjectedObject | null;
};

export type FollowedObjectsUpdatesFeedResponseDto = {
  items: FollowedObjectUpdateFeedItemDto[];
  cursor: string | null;
  hasMore: boolean;
};
