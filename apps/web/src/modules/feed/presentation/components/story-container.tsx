import type { FeedTab } from '../../domain/feed-tab';
import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import type { ObjectPostReviewContext } from '../hooks/use-object-post-review';
import { Story } from './story';

export type StoryContainerProps = {
  story: FeedStoryView;
  feedTab?: FeedTab;
  currentUsername: string | null;
  onBroadcastRevalidate?: () => Promise<void>;
  /** Object Posts feed only: Pin / Unpin / Remove for the object. */
  objectReview?: ObjectPostReviewContext;
};

/**
 * Thin container: maps feed context onto {@link Story}. No client store — data comes from the server.
 */
export function StoryContainer({
  story,
  feedTab,
  currentUsername,
  onBroadcastRevalidate,
  objectReview,
}: StoryContainerProps) {
  return (
    <Story
      story={story}
      feedTab={feedTab}
      currentUsername={currentUsername}
      onBroadcastRevalidate={onBroadcastRevalidate}
      objectReview={objectReview}
    />
  );
}
