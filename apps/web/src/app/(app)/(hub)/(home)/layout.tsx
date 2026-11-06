import type { ReactNode } from 'react';

import { HomeFeedMenu, HomeFeedScrollReset } from '@/modules/home';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * Hub feed shell, same three-column grid as the profile: left tab rail
 * (Posts / Threads / Activity / Updates) | feed | right column (reserved, empty for now).
 * Below `lg` the rail becomes horizontal tabs above the feed.
 *
 * The rail sticks below the app header and the hub section nav; `--hub-section-nav-height`
 * is published by `HubStickySectionNav`.
 */
export default function HomeFeedLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        'mt-card-padding grid grid-cols-1 gap-card-padding',
        'lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
      ].join(' ')}
    >
      <HomeFeedScrollReset />
      <aside className="hidden min-w-0 lg:block">
        <div
          className={[
            'sticky top-[calc(var(--shell-header-height)+var(--hub-section-nav-height,0px)+var(--spacing-card))]',
            'max-h-[calc(100dvh-var(--shell-header-height)-var(--hub-section-nav-height,0px)-var(--spacing-card))]',
            'overflow-y-auto overflow-x-hidden',
          ].join(' ')}
        >
          <HomeFeedMenu orientation="vertical" />
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mb-card-padding lg:hidden">
          <HomeFeedMenu orientation="horizontal" />
        </div>
        {children}
      </div>
      <aside className="hidden min-w-0 lg:block" aria-hidden />
    </div>
  );
}
