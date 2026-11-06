import { Suspense } from 'react';

import { HubStickySectionNav } from '@/modules/app-header';
import {
  InstantNavigationProvider,
  OptimisticNavProvider,
  OptimisticNavSync,
} from '@/shared/presentation';

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
