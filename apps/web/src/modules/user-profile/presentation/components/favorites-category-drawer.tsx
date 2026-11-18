'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { DrawerRegion } from '@/shared/presentation/layout';

import { parseFavoritesPath } from '../../domain/favorites-path';

type FavoritesCategoryDrawerState = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const DrawerStateContext = createContext<FavoritesCategoryDrawerState | null>(null);

/** Set only inside the drawer: lets the rail switch to its drawer layout and close it. */
type FavoritesCategoryDrawerScope = { close: () => void };

const DrawerScopeContext = createContext<FavoritesCategoryDrawerScope | null>(null);

/**
 * Open state of the mobile Favorites category drawer. Lives in the profile `(main)` layout, not
 * in the page: every category URL re-renders the page segment, and the drawer stays open while
 * the viewer drills into subcategories. It closes once the URL leaves Favorites.
 */
export function FavoritesCategoryDrawerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onFavorites = parseFavoritesPath(pathname) !== null;
  if (open && !onFavorites) {
    setOpen(false);
  }
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openDrawer, closeDrawer }), [open, openDrawer, closeDrawer]);
  return <DrawerStateContext.Provider value={value}>{children}</DrawerStateContext.Provider>;
}

/** Trigger side (breadcrumb button); `null` outside the provider. */
export function useFavoritesCategoryDrawerState(): FavoritesCategoryDrawerState | null {
  return useContext(DrawerStateContext);
}

/** Rail side: `null` in the desktop rail, the close action inside the drawer. */
export function useFavoritesCategoryDrawerScope(): FavoritesCategoryDrawerScope | null {
  return useContext(DrawerScopeContext);
}

/**
 * Below `lg`: the Favorites left rail (`leftSidebar` slot) in a left drawer under the app header,
 * same pattern as the hub feed filters and the Discover type picker. Back closes it; links in it
 * navigate with `replace` (`CategoryNavDrawerList`), which keeps history the same as plain links.
 */
export function FavoritesCategoryDrawer({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const state = useContext(DrawerStateContext);
  const closeDrawer = state?.closeDrawer;
  const scope = useMemo(() => (closeDrawer ? { close: closeDrawer } : null), [closeDrawer]);
  if (!state || !scope) {
    return null;
  }
  return (
    <DrawerRegion
      open={state.open}
      onClose={state.closeDrawer}
      side="left"
      belowHeader
      size="wide"
      closeOnBack
      ariaLabel={t('favorites_categories_aria')}
    >
      <DrawerScopeContext.Provider value={scope}>{children}</DrawerScopeContext.Provider>
    </DrawerRegion>
  );
}
