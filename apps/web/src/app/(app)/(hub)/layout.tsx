import { Suspense } from 'react';

import { HubStickySectionNav } from '@/modules/app-header';
import {
  InstantNavigationProvider,
  OptimisticNavProvider,
  OptimisticNavSync,
} from '@/shared/presentation';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <OptimisticNavProvider>
      <InstantNavigationProvider>
        {/* Clears the optimistic tab on Back/Forward so hub and feed tabs follow the URL. */}
        <Suspense fallback={null}>
          <OptimisticNavSync />
        </Suspense>
        <div className="min-w-0">
          <HubStickySectionNav />
          <div className="min-w-0 lg:overflow-x-clip">{children}</div>
        </div>
      </InstantNavigationProvider>
    </OptimisticNavProvider>
  );
}
