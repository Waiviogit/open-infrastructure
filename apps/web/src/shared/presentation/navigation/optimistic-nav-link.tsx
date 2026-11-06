'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { useCallback, useContext } from 'react';

import {
  PendingNavControlsContext,
} from './optimistic-nav-context';
import { useInstantNavigation } from './use-instant-navigation';

type OptimisticNavLinkProps = Omit<ComponentProps<typeof Link>, 'prefetch' | 'onClick'> & {
  children: ReactNode;
  /** Use `replace` for same-route query changes (default `push`). */
  method?: 'push' | 'replace';
  /**
   * Prefetch the destination's static shell (Cache Components) when the link is visible, so the
   * click paints the route skeleton without a round trip. Off by default: enable it for small,
   * fixed menus, not for long lists of links.
   */
  prefetchShell?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Navigation link with instant URL + optimistic active state on click.
 * Requires {@link OptimisticNavProvider} ancestor for pending active tab sync.
 */
export function OptimisticNavLink({
  href,
  children,
  method = 'push',
  prefetchShell = false,
  suppressHydrationWarning = true,
  onClick,
  scroll = false,
  ...rest
}: OptimisticNavLinkProps) {
  const { navigateInstant } = useInstantNavigation();
  const pendingControls = useContext(PendingNavControlsContext);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }

      const resolvedHref = typeof href === 'string' ? href : '';
      if (!resolvedHref) {
        return;
      }

      event.preventDefault();
      navigateInstant({
        href: resolvedHref,
        method,
        scroll,
        onPending: pendingControls?.setPendingTarget,
      });
    },
    [href, method, navigateInstant, onClick, pendingControls, scroll],
  );

  return (
    <Link
      href={href}
      prefetch={prefetchShell ? null : false}
      suppressHydrationWarning={suppressHydrationWarning}
      onClick={handleClick}
      scroll={scroll}
      {...rest}
    >
      {children}
    </Link>
  );
}
