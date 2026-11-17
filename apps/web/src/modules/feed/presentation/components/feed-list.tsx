import type { FeedTab } from '../../domain/feed-tab';
import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import type { ObjectPostReviewContext } from '../hooks/use-object-post-review';
import { StoryContainer } from './story-container';

export type FeedListProps = {
  items: FeedStoryView[];
  feedTab: FeedTab;
  currentUsername: string | null;
  /** Extra cache/path revalidation after a Hive broadcast (e.g. object Social feed). */
  onBroadcastRevalidate?: () => Promise<void>;
  /** Object Posts feed only: Pin / Unpin / Remove on each post card. */
  objectReview?: ObjectPostReviewContext;
};

export function FeedList({
  items,
  feedTab,
  currentUsername,
  onBroadcastRevalidate,
  objectReview,
}: FeedListProps) {
  return (
    <ul className="flex list-none flex-col gap-card-padding p-0">
      {items.map((story) => (
        <li key={story.id} className="relative">
          <StoryContainer
            story={story}
            feedTab={feedTab}
            currentUsername={currentUsername}
            onBroadcastRevalidate={onBroadcastRevalidate}
            objectReview={objectReview}
          />
        </li>
      ))}
    </ul>
  );
}
