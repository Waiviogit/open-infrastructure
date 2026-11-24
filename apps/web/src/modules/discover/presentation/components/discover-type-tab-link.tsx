'use client';

import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/icons';
import { OptimisticNavLink } from '@/shared/presentation';

import { writeDiscoverObjectTypeCookie } from '../../domain/discover-type-cookie';

export const DISCOVER_TAB_ICON_SIZE = 18;

export type DiscoverTypeTabLinkProps = {
  href: string;
  icon: IconName;
  label: ReactNode;
  active: boolean;
  className: string;
  /** Registry type remembered in the cookie on click; omitted for Users. */
  rememberType?: string;
  onNavigate?: () => void;
};

/**
 * One discover type entry (menu tab or More row). Same-route query change: replaces the URL
 * and keeps the scroll position.
 */
export function DiscoverTypeTabLink({
  href,
  icon,
  label,
  active,
  className,
  rememberType,
  onNavigate,
}: DiscoverTypeTabLinkProps) {
  return (
    <OptimisticNavLink
      href={href}
      method="replace"
      className={className}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        if (rememberType) {
          writeDiscoverObjectTypeCookie(rememberType);
        }
        onNavigate?.();
      }}
    >
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <Icon name={icon} size={DISCOVER_TAB_ICON_SIZE} className="shrink-0" />
        {label}
      </span>
    </OptimisticNavLink>
  );
}
