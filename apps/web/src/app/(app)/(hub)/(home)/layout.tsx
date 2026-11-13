import { Suspense, type ReactNode } from 'react';

import { HomeFeedScrollReset, HomeFeedTabBand } from '@/modules/home';
import { HomeFeedMobileFilters } from '@/modules/home/presentation/components/filters/home-feed-mobile-filters';

/**
 * Hub feed shell: tab band (Posts / Threads / Activity / Updates) under the hub section nav,
 * then the same three-column grid as the profile: filter rail | feed | right column
 * (reserved, empty for now). Below `lg` the rail (`filters` slot) opens in a drawer.
 *
 * The rail sticks below the app header and the hub section nav; `--hub-section-nav-height`
 * is published by `HubStickySectionNav`. The tab band is not sticky, so it does not change
 * that offset.
 */
export default function HomeFeedLayout({
  children,
  filters,
}: {
  children: ReactNode;
  filters: ReactNode;
}) {
  return (
    <>
      <HomeFeedTabBand />
      <div
        className={[
          'mt-card-padding grid grid-cols-1 gap-card-padding',
          'lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
        ].join(' ')}
      >
        <Suspense fallback={null}>
          <HomeFeedScrollReset />
        </Suspense>
        <aside className="hidden min-w-0 lg:block">
          <div
            className={[
              'sticky top-[calc(var(--shell-header-height)+var(--hub-section-nav-height,0px)+var(--spacing-card))]',
              'max-h-[calc(100dvh-var(--shell-header-height)-var(--hub-section-nav-height,0px)-var(--spacing-card))]',
              'overflow-y-auto overflow-x-hidden scrollbar-minimal',
            ].join(' ')}
          >
            {filters}
          </div>
        </aside>
        <div className="min-w-0">
          <Suspense fallback={null}>
            <HomeFeedMobileFilters>{filters}</HomeFeedMobileFilters>
          </Suspense>
          {children}
        </div>
        <aside className="hidden min-w-0 lg:block" aria-hidden />
      </div>
    </>
  );
}
