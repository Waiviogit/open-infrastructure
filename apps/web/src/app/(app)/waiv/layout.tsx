import { Suspense, type ReactNode } from 'react';

import { WaivPageShell } from '@/modules/waiv-token';
import { OptimisticNavProvider, OptimisticNavSync, ScrollToTopOnEnter } from '@/shared/presentation';

/** `/waiv` and `/waiv/swaps` share the title and the tab row; only the content slot reloads. */
export default function WaivLayout({ children }: { children: ReactNode }) {
  return (
    <OptimisticNavProvider>
      <Suspense fallback={null}>
        <OptimisticNavSync />
      </Suspense>
      <ScrollToTopOnEnter routeKey="waiv" />
      <WaivPageShell>{children}</WaivPageShell>
    </OptimisticNavProvider>
  );
}
