'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { FilterIcon } from '@/icons';

import { MOBILE_ACTION_PILL_CLASS } from './mobile-pill-class';
import { ModalShell } from './modal-shell';

export type MobileFilterButtonProps = {
  onClick: () => void;
  /** Sheet open state, for `aria-expanded`. */
  expanded?: boolean;
};

/**
 * The one mobile `Filter` trigger (Discover, Favorites): accent pill with the filter glyph.
 * Opens a {@link MobileFilterSheet}. Callers hide it from `lg` up.
 */
export function MobileFilterButton({ onClick, expanded }: MobileFilterButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={MOBILE_ACTION_PILL_CLASS}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <FilterIcon size={16} className="shrink-0" />
      {t('discover_add_filter')}
    </button>
  );
}

export type MobileFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  /** Extra header row under the title (e.g. Discover's filter search). */
  headerExtra?: ReactNode;
  children: ReactNode;
};

/**
 * The one mobile filter bottom sheet (Discover, Favorites): handle, `Filters` title with Clear,
 * the facets as children, and Show results (closes the sheet; toggles already applied).
 */
export function MobileFilterSheet({
  open,
  onClose,
  onClear,
  headerExtra,
  children,
}: MobileFilterSheetProps) {
  const { t } = useI18n();
  return (
    <ModalShell
      open={open}
      onClose={onClose}
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
              onClick={onClear}
            >
              {t('discover_clear')}
            </button>
          </div>
          {headerExtra}
        </div>
      }
      footer={
        <div className="border-t border-border px-gutter py-3">
          <button
            type="button"
            className="w-full rounded-btn bg-accent px-4 py-3 text-body font-weight-label text-on-accent"
            onClick={onClose}
          >
            {t('discover_show_results')}
          </button>
        </div>
      }
    >
      {children}
    </ModalShell>
  );
}
