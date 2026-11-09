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
 * Default prefetch: a visible link prefetches the route shell — `object/loading.tsx`, which sits
 * above the blocking `[object-id]` layout — so the click paints the object skeleton without a
 * round trip. Cost under Partial Prefetching: one small `/_tree` request per visible distinct
 * object; the shell segment is fetched once and shared by all object links. Hover-only
 * prefetch was not enough: those two requests do not finish between hover and click at real
 * network latency.
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

  const reportPending = (next: boolean) => {
    setPending(next);
    onPendingChange?.(next);
  };

  return (
    <Link
      href={href}
      replace={replace}
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
