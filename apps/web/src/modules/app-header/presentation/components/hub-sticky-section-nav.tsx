'use client';

import { useEffect, useRef } from 'react';

import { AppSectionNav } from './app-section-nav';

/**
 * Height of the sticky hub section nav, published on the hub root so sticky rails
 * below it can offset by `var(--shell-header-height) + var(--hub-section-nav-height)`.
 */
export const HUB_SECTION_NAV_HEIGHT_VAR = '--hub-section-nav-height';

/** Hub section nav pinned under the app header; publishes its height for sticky rails. */
export function HubStickySectionNav() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    const hubRoot = element?.parentElement;
    if (!element || !hubRoot) {
      return;
    }
    const publish = () => {
      hubRoot.style.setProperty(HUB_SECTION_NAV_HEIGHT_VAR, `${element.offsetHeight}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      hubRoot.style.removeProperty(HUB_SECTION_NAV_HEIGHT_VAR);
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-[var(--shell-header-height)] z-30 min-w-0">
      <AppSectionNav />
    </div>
  );
}
