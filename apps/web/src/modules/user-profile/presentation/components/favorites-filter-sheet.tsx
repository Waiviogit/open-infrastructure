'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { FilterIcon } from '@/icons';
import { ModalShell, useInstantNavigation } from '@/shared/presentation';

import { parseFavoritesPath } from '../../domain/favorites-path';
import { buildProfileShopHref } from '../../domain/profile-shop-filters-url';
import {
  shopTypesHaveRatingFilters,
  shopTypesHaveTagFilters,
} from '../../domain/profile-shop-registry';
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

/** True when the type has rating or tag facets (the right rail would show filters). */
export function favoritesTypeHasFilters(objectType: string): boolean {
  return shopTypesHaveTagFilters([objectType]) || shopTypesHaveRatingFilters([objectType]);
}

/**
 * Below `lg`: `Filter` button above the Favorites list (same look as Discover's `+ Filter`).
 * Rendered only for a type with rating or tag facets.
 */
export function FavoritesMobileFilterButton({ objectType }: { objectType: string }) {
  const { t } = useI18n();
  const sheet = useContext(SheetStateContext);
  if (!sheet || !favoritesTypeHasFilters(objectType)) {
    return null;
  }
  return (
    <div className="mb-card-padding lg:hidden">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-pill border border-accent px-3 py-1 text-body-sm font-weight-label text-accent"
        aria-haspopup="dialog"
        aria-expanded={sheet.open}
        onClick={sheet.openSheet}
      >
        <FilterIcon size={16} className="shrink-0" />
        {t('discover_add_filter')}
      </button>
    </div>
  );
}

/**
 * Mobile filter sheet of the Favorites tab: the right rail's facets (`ProfileFavoritesFiltersFromUrl`,
 * `variant="sheet"`) in a bottom sheet, like the Discover filter sheet. Toggles apply at once via
 * URL replace; active filters stay as chips above the list.
 */
export function FavoritesFilterSheet({ accountName }: { accountName: string }) {
  const { t } = useI18n();
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
    <ModalShell
      open={sheet.open}
      onClose={sheet.closeSheet}
      variant="sheet"
      ariaLabel={t('discover_filters_title')}
      scrollBody
      header={
        <div className="border-b border-border px-gutter pb-3 pt-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-border" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-heading font-weight-label text-fg">{t('discover_filters_title')}</h2>
            <button
              type="button"
              className="text-body-sm font-weight-label text-accent"
              onClick={clearFilters}
            >
              {t('discover_clear')}
            </button>
          </div>
        </div>
      }
      footer={
        <div className="border-t border-border px-gutter py-3">
          <button
            type="button"
            className="w-full rounded-btn bg-accent px-4 py-3 text-body font-weight-label text-on-accent"
            onClick={sheet.closeSheet}
          >
            {t('discover_show_results')}
          </button>
        </div>
      }
    >
      <div className="px-gutter py-3">
        <ProfileFavoritesFiltersFromUrl accountName={accountName} variant="sheet" />
      </div>
    </ModalShell>
  );
}
