'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';

import { PROFILE_SUBMENU_CARD_CLASS } from './profile-submenu-classes';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { getSubmenuVariant } from './user-profile-subnav';
import { UserMenuSkeleton } from './user-menu-skeleton';

const UserMenuClient = dynamic(
  () => import('./user-menu').then((m) => ({ default: m.UserMenu })),
  { ssr: false, loading: () => <UserMenuSkeleton rows="submenu" /> },
);

export type UserProfileSubmenuProps = {
  accountName: string;
  /**
   * Server-rendered Favorites types menu (brings its own card); shown on Favorites routes.
   * The types are account data, so they come from the layout instead of the client menu.
   */
  favoritesTypesMenu?: ReactNode;
};

/**
 * Center-column sub-tabs (profile main layout), parity with object Social
 * {@link ObjectPrimaryContent} + {@link ObjectFeedSubNav}.
 */
export function UserProfileSubmenu({
  accountName,
  favoritesTypesMenu = null,
}: UserProfileSubmenuProps) {
  const { pathname } = useEffectiveProfileNav();
  const variant = pathname ? getSubmenuVariant(pathname) : null;

  if (!variant) {
    return null;
  }

  if (variant === 'favorites') {
    return favoritesTypesMenu;
  }

  return (
    <div className={PROFILE_SUBMENU_CARD_CLASS}>
      <UserMenuClient accountName={accountName} rows="submenu" />
    </div>
  );
}
