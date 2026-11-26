'use client';

import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export type IntentPrefetchLinkProps = {
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
 * Link to an entity page whose layout paints a cached head (hero) before the full page, with
 * instant pending feedback. Prefetch in two steps:
 * - visible: the route shell (`prefetch="auto"`) — the route's entry skeleton. Under Partial
 *   Prefetching: one small `/_tree` request per visible distinct URL; the shell segment is shared.
 * - intent (hover, focus, touch): `prefetch={true}` — the per-link prefetch adds the entity head,
 *   so the hero paints on click. One server render per pointed-at link; the full page sits below
 *   `navigation()` and stays out of it.
 * @see docs/apps/web/spec/caching.md (prefetch decisions)
 */
export function IntentPrefetchLink({
  href,
  replace = false,
  className,
  ariaLabel,
  title,
  children,
  onPendingChange,
}: IntentPrefetchLinkProps) {
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
