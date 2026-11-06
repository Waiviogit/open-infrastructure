import { ObjectPageLoadingSkeleton } from '@/modules/object/presentation/components/object-page-loading-skeleton';
import { ScrollToTopOnEnter } from '@/shared/presentation';

/**
 * Prefetch of `/object/:id` stops here — `[object-id]/layout` is not rendered.
 * The skeleton is the first object frame, so it resets the scroll: the layout's own
 * `ScrollToTopOnEnter` only mounts after the server renders the object model.
 */
export default function ObjectRouteLoading() {
  return (
    <>
      <ScrollToTopOnEnter routeKey="object-route-loading" />
      <ObjectPageLoadingSkeleton />
    </>
  );
}
