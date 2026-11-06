'use client';

import { usePathname } from 'next/navigation';

import { ScrollToTopOnEnter } from '@/shared/presentation';

/**
 * Each hub feed tab is its own list: switching tabs starts at the top.
 * Back/Forward keeps the saved offset (`ScrollToTopOnEnter` skips pending restores).
 */
export function HomeFeedScrollReset() {
  const pathname = usePathname();
  return <ScrollToTopOnEnter routeKey={pathname} />;
}
