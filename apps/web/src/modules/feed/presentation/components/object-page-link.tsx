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
 * Prefetch in two steps:
 * - visible: the route shell (`prefetch="auto"`) — `object/loading.tsx`, above the blocking
 *   `[object-id]` layout — so the click paints the object skeleton without a round trip. Cost under
 *   Partial Prefetching: one small `/_tree` request per visible distinct object; the shell segment
 *   is fetched once and shared by all object links.
 * - intent (hover, focus, touch): `prefetch={true}` — the per-link prefetch adds the object head
 *   (name, avatar, cover), so the hero paints on click. One server render per pointed-at link; the
 *   full page stays out of it (`navigation()` in the object layout and page).
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
  const [intent, setIntent] = useState(false);
  const showIntent = () => setIntent(true);

  const reportPending = (next: boolean) => {
    setPending(next);
    onPendingChange?.(next);
  };

  return (
    <Link
      href={href}
      replace={replace}
      prefetch={intent ? true : 'auto'}
      onMouseEnter={showIntent}
      onFocus={showIntent}
      onTouchStart={showIntent}
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
