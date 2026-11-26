import { Suspense } from 'react';

import { OptimisticNavProvider, OptimisticNavSync, ScrollToTopOnEnter } from '@/shared/presentation';
import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { ObjectHeadShell } from '@/modules/object';
import { ObjectPageLoadingSkeleton } from '@/modules/object/presentation/components/object-page-loading-skeleton';

import { loadObjectHead } from './object-page-model.server';
import { ObjectPageFullSection } from './object-page-full-section.server';

// Deliberate Block: the layout awaits `params`, the locale and the cached object head at its top, so
// a link prefetch (`prefetch={true}` on intent) carries the hero; a default link stops at the
// `object/loading.tsx` skeleton above. The full page streams behind the head shell. Existence is
// decided inside that boundary (`notFound()` streams the not-found UI with `noindex`, as before).
export const instant = false;

export default async function ObjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ 'object-id': string }>;
}) {
  const { 'object-id': rawId } = await params;
  const objectId = decodeURIComponent(rawId);
  const locale = await getRequestLocale();
  // A failed head read is cached for a moment and may sit in a prefetch: it never decides 404,
  // it only falls back to the generic skeleton.
  const head = await loadObjectHead(objectId, locale);

  return (
    <OptimisticNavProvider>
      <ScrollToTopOnEnter routeKey={objectId} />
      <Suspense fallback={null}>
        <OptimisticNavSync />
      </Suspense>
      <Suspense fallback={head ? <ObjectHeadShell head={head} /> : <ObjectPageLoadingSkeleton />}>
        <ObjectPageFullSection objectId={objectId} locale={locale}>
          {children}
        </ObjectPageFullSection>
      </Suspense>
    </OptimisticNavProvider>
  );
}
