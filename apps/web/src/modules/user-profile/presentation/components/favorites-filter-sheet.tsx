'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { MobileFilterButton, MobileFilterSheet, useInstantNavigation } from '@/shared/presentation';

import { parseFavoritesPath } from '../../domain/favorites-path';
import { buildProfileShopHref } from '../../domain/profile-shop-filters-url';
import { favoritesTypeHasFilters } from '../../domain/profile-shop-registry';
import { ProfileFavoritesFiltersFromUrl } from './profile-shop-filters';

type FavoritesFilterSheetState = {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

const SheetStateContext = createContext<FavoritesFilterSheetState | null>(null);

/**
 * Open state of the mobile Favorites filter sheet. Lives in the profile `(main)` layout like the
 * category drawer: every toggle replaces the URL and re-renders the page segment, and the sheet
 * stays open across those navigations. It closes once the URL leaves Favorites.
 */
export function FavoritesFilterSheetProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (open && parseFavoritesPath(pathname) === null) {
    setOpen(false);
  }
  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openSheet, closeSheet }), [open, openSheet, closeSheet]);
  return <SheetStateContext.Provider value={value}>{children}</SheetStateContext.Provider>;
}

/**
 * Below `lg`: `Filter` button of the Favorites toolbar (shared `MobileFilterButton`, as on
 * Discover). Rendered only for a type with rating or tag facets; the caller places it next to the
 * breadcrumbs or after the filter chips.
 */
export function FavoritesMobileFilterButton({ objectType }: { objectType: string }) {
  const sheet = useContext(SheetStateContext);
  if (!sheet || !favoritesTypeHasFilters(objectType)) {
    return null;
  }
  return (
    <div className="shrink-0 lg:hidden">
      <MobileFilterButton onClick={sheet.openSheet} expanded={sheet.open} />
    </div>
  );
}

/**
 * Mobile filter sheet of the Favorites tab: the right rail's facets (`ProfileFavoritesFiltersFromUrl`,
 * `variant="sheet"`) in the shared `MobileFilterSheet`, like Discover. Toggles apply at once via
 * URL replace; active filters stay as chips above the list.
 */
export function FavoritesFilterSheet({ accountName }: { accountName: string }) {
  const sheet = useContext(SheetStateContext);
  const pathname = usePathname();
  const { navigateInstant } = useInstantNavigation();
  if (!sheet) {
    return null;
  }

  const clearFilters = () => {
    navigateInstant({
      href: buildProfileShopHref(pathname, { tags: [], rating: null }),
      method: 'replace',
      scroll: false,
    });
  };

  return (
    <MobileFilterSheet open={sheet.open} onClose={sheet.closeSheet} onClear={clearFilters}>
      <div className="px-gutter py-3">
        <ProfileFavoritesFiltersFromUrl accountName={accountName} variant="sheet" />
      </div>
    </MobileFilterSheet>
  );
}
