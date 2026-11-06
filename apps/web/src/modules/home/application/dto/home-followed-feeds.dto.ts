import { z } from 'zod';

import { projectedObjectApiSchema } from '@/modules/feed/application/mappers/feed-story-from-api.mapper';
import type { MessageItem } from '@/modules/messaging/domain/messaging.types';
import { objectUpdateFeedItemDtoSchema } from '@/modules/object-updates/application/dto/object-updates-feed.dto';

/** `POST /users/:name/following-objects/updates` item: update row + the updated object. */
export const homeUpdateFeedItemApiSchema = objectUpdateFeedItemDtoSchema.extend({
  object: projectedObjectApiSchema.nullable().default(null),
});

export const homeUpdatesFeedResponseSchema = z.object({
  items: z.array(homeUpdateFeedItemApiSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type HomeUpdateFeedItemView = z.infer<typeof homeUpdateFeedItemApiSchema>;

export type HomeUpdatesFeedPage = {
  items: HomeUpdateFeedItemView[];
  cursor: string | null;
  hasMore: boolean;
};

const followedObjectMessageApiSchema = z
  .object({
    message_id: z.string(),
    channel_id: z.string(),
    author: z.string(),
    created_at_unix: z.number(),
    object: z.object({ object_id: z.string(), name: z.string() }),
  })
  .passthrough();

/** `POST /users/:name/following-objects/messages` page. */
export const homeActivityFeedResponseSchema = z.object({
  items: z.array(followedObjectMessageApiSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type HomeActivityFeedPage = {
  items: MessageItem[];
  cursor: string | null;
  hasMore: boolean;
};

/**
 * The followed object becomes the message `source_object`, so `MessageRow`
 * renders the "From {object}" link without a home-specific row component.
 */
export function mapFollowedObjectMessageToItem(
  message: z.infer<typeof followedObjectMessageApiSchema>,
): MessageItem {
  const { object, ...rest } = message;
  const item = rest as unknown as MessageItem;
  return {
    ...item,
    source_object: item.source_object ?? { object_id: object.object_id, name: object.name },
  };
}
