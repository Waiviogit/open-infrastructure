'use client';

import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type ObjectPageLinkProps = {
  href: string;
  replace?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
  children: ReactNode;
  /** When set, toggles while this link is navigating (e.g. dim the whole card). */
  onPendingChange?: (pending: boolean) => void;
};

function LinkPendingReporter({ onPendingChange }: { onPendingChange?: (pending: boolean) => void }) {
  const { pending } = useLinkStatus();

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  return null;
}

function mergePendingClass(className: string | undefined, pending: boolean): string | undefined {
  if (!pending) {
    return className;
  }
  const pendingClass = 'cursor-wait opacity-70 transition-opacity';
  return className ? `${className} ${pendingClass}` : pendingClass;
}

/**
 * Client navigation to `/object/…` with instant pending feedback.
 *
 * Prefetch on intent (hover / touch / focus), not on viewport: a feed shows many object
 * links, and viewport prefetch would issue one request per card. With intent the default
 * prefetch (`null`) loads the route down to `object/loading.tsx` — the skeleton, not
 * `[object-id]/layout` — so the click paints the skeleton without waiting for a round trip.
 */
export function ObjectPageLink({
  href,
  replace = false,
  className,
  ariaLabel,
  title,
  children,
  onPendingChange,
}: ObjectPageLinkProps) {
  const [pending, setPending] = useState(false);
  const [prefetchIntent, setPrefetchIntent] = useState(false);

  const reportPending = (next: boolean) => {
    setPending(next);
    onPendingChange?.(next);
  };
  const showPrefetchIntent = () => setPrefetchIntent(true);

  return (
    <Link
      href={href}
      replace={replace}
      prefetch={prefetchIntent ? null : false}
      onMouseEnter={showPrefetchIntent}
      onTouchStart={showPrefetchIntent}
      onFocus={showPrefetchIntent}
      aria-label={ariaLabel}
      title={title}
      aria-busy={pending || undefined}
      suppressHydrationWarning
      className={mergePendingClass(className, pending)}
    >
      <LinkPendingReporter onPendingChange={reportPending} />
      {children}
    </Link>
  );
}
