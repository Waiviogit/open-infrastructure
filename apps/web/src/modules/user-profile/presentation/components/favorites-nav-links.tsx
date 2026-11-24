'use client';

import type { CategoryNavLinkProps } from '@/shared/presentation/category-nav';

import { UserProfileNavLink } from './user-profile-nav-link';

/** Favorites rail and breadcrumb link (push, optimistic profile nav). */
export function FavoritesNavLink(props: CategoryNavLinkProps) {
  return <UserProfileNavLink {...props} />;
}

/** Favorites drawer link: `replace`, so it takes the place of the drawer's Back entry. */
export function FavoritesDrawerNavLink(props: CategoryNavLinkProps) {
  return <UserProfileNavLink method="replace" {...props} />;
}
