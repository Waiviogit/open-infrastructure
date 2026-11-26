'use client';

import {
  IntentPrefetchLink,
  type IntentPrefetchLinkProps,
} from '@/shared/presentation/components/intent-prefetch-link';

/**
 * Client navigation to `/object/…`: the visible link prefetches `object/loading.tsx` (shell), a
 * pointed-at link the object head, so the hero paints on click (see {@link IntentPrefetchLink}).
 */
export function ObjectPageLink(props: IntentPrefetchLinkProps) {
  return <IntentPrefetchLink {...props} />;
}
