'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { useInstantNavigation } from '@/shared/presentation';

import { isUserProfileFavoritesTab } from '../../domain/profile-shop-filters-url';
import { ProfileMainPendingSkeleton } from './profile-main-pending-skeleton';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';

/** Inset of the overlay for tabs whose content sits inside a padded card. */
const PENDING_OVERLAY_INSET_CLASS = 'px-card-padding pt-2';

/**
 * Instant nav overlay for profile center column — keeps submenu/hero responsive
 * while RSC loads the next route (parity with object page center shell).
 * Favorites content is not inset, so its overlay has no padding: the skeleton breadcrumbs and
 * cards sit exactly where the loaded ones will, and the column does not jump.
 */
export function UserProfileMainContentPendingShell({
  children,
}: {
  children: ReactNode;
}) {
  const { isNavigating } = useInstantNavigation();
  const { pathname } = useEffectiveProfileNav();
  const overlayInset = isUserProfileFavoritesTab(pathname) ? '' : PENDING_OVERLAY_INSET_CLASS;

  return (
    <div className="relative min-h-[12rem] min-w-0">
      <div
        className={isNavigating ? 'pointer-events-none select-none' : undefined}
        aria-hidden={isNavigating ? true : undefined}
      >
        {children}
      </div>
      {isNavigating ? (
        <div
          className={['absolute inset-0 z-30 bg-bg', overlayInset].filter(Boolean).join(' ')}
          aria-busy="true"
          aria-label="Loading profile content"
          aria-live="polite"
        >
          <Suspense fallback={null}>
            <ProfileMainPendingSkeleton />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
