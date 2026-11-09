import { ObjectPageCenterSkeleton } from '@/modules/object/presentation/components/object-page-loading-skeleton';

/** `/business/*` content skeleton: segment `loading.tsx` and in-page `<Suspense>` fallbacks. */
export function BusinessContentSkeleton() {
  return (
    <div className="min-h-[12rem]" aria-busy="true" aria-label="Loading business">
      <ObjectPageCenterSkeleton />
    </div>
  );
}
