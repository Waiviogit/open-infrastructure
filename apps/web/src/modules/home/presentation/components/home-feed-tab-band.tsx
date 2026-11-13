import { Suspense } from 'react';

import { ShellFullBleedBand, ShellInset } from '@/shared/presentation/layout';

import { HomeFeedTabNav, HomeFeedTabNavView } from './home-feed-tab-nav';

/**
 * Hub feed tabs as a full-width band under the hub section nav, aligned with the feed
 * column (same band as the profile and object menus). Not sticky: the left rail keeps
 * its offset below the sticky hub section nav.
 */
export function HomeFeedTabBand() {
  return (
    <ShellFullBleedBand className="bg-surface shadow-card">
      <ShellInset className="pt-0">
        <div
          className={[
            'shell-profile-grid grid grid-cols-1 gap-x-card-padding',
            'lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
          ].join(' ')}
        >
          <div className="min-w-0 lg:col-start-2">
            <Suspense fallback={<HomeFeedTabNavView activeKey={null} search="" />}>
              <HomeFeedTabNav />
            </Suspense>
          </div>
        </div>
      </ShellInset>
    </ShellFullBleedBand>
  );
}
