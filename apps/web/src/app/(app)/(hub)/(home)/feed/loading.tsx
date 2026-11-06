import { FeedPostsLoadingSkeleton } from '@/modules/feed/presentation';

export default function HomeFeedLoading() {
  return (
    <main className="min-w-0 pb-section-y">
      <FeedPostsLoadingSkeleton />
    </main>
  );
}
