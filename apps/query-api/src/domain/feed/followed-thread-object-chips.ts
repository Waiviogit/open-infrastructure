import type { ProjectedObject } from '../object-projection/projected-object.types';
import type { FeedStoryItemDto } from './feed-story-dtos';

/**
 * Sets `objects` on thread feed items to the followed objects tagged in each thread,
 * in hashtag order, capped at `limit`.
 */
export function attachFollowedThreadObjectChips(
  items: readonly FeedStoryItemDto[],
  hashtagsByItemId: ReadonlyMap<string, readonly string[]>,
  projectedById: ReadonlyMap<string, ProjectedObject>,
  limit: number,
): FeedStoryItemDto[] {
  return items.map((item) => {
    const hashtags = hashtagsByItemId.get(item.id) ?? [];
    const objects = [...new Set(hashtags)]
      .map((id) => projectedById.get(id))
      .filter((projected): projected is ProjectedObject => projected != null)
      .slice(0, limit);
    return { ...item, objects };
  });
}
