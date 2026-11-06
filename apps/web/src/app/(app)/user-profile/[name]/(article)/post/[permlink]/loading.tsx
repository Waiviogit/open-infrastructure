import { FeedColumn } from '@/shared/presentation/layout';
import { ScrollToTopOnEnter } from '@/shared/presentation';

const BODY_LINE_WIDTHS = ['w-full', 'w-full', 'w-5/6', 'w-full', 'w-4/5', 'w-full', 'w-3/4'];

/**
 * Full post page entry frame: title, author row and body lines of `BlogPostScreen` (page variant).
 */
export default function UserBlogPostLoading() {
  return (
    <FeedColumn>
      <ScrollToTopOnEnter routeKey="article-route-loading" />
      <div className="animate-pulse" aria-busy="true" aria-label="Loading post">
        <div className="h-8 w-3/4 rounded bg-surface-control" />
        <div className="mt-4 flex gap-3">
          <div className="size-10 shrink-0 rounded-circle bg-surface-control" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-4 w-32 rounded bg-surface-control" />
            <div className="h-3 w-20 rounded bg-surface-control" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {BODY_LINE_WIDTHS.map((width, index) => (
            <div key={index} className={`h-4 rounded bg-surface-control ${width}`} />
          ))}
        </div>
      </div>
    </FeedColumn>
  );
}
