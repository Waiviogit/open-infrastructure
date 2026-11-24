'use client';

import type { ReactNode } from 'react';

import { CloseIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';

/** Pill for an active filter (search, tag, rating, map area, anchored object). */
export const ACTIVE_FILTER_CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1 rounded-pill border border-border bg-surface-control px-2 py-0.5 text-caption text-fg';

export type ActiveFilterChipItem = {
  key: string;
  label: string;
  /** Accessible name of the chip's remove button. */
  removeLabel: string;
  onRemove: () => void;
};

export type ActiveFilterChipsProps = {
  items: readonly ActiveFilterChipItem[];
  onClearAll: () => void;
  /**
   * Below `lg`: the Filter button, after the chips (alone on its row when no filter is active).
   * The caller hides it from `lg` up.
   */
  trailing?: ReactNode;
};

/**
 * Active filters as removable chips (Discover, profile Favorites). From `lg` up they sit under an
 * `Active filters (n) · Clear all` heading; below `lg` they share one wrapping row with the
 * Filter button (the filter sheet has its own Clear).
 */
export function ActiveFilterChips({
  items,
  onClearAll,
  trailing,
}: ActiveFilterChipsProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return trailing ? (
      <div className="mb-card-padding lg:hidden">{trailing}</div>
    ) : null;
  }

  return (
    <div className="mb-4">
      <div className="mb-1.5 hidden items-center justify-between gap-2 lg:flex">
        <span className="text-caption font-weight-label text-fg-tertiary">
          {t('discover_active_filters', { count: items.length })}
        </span>
        <button
          type="button"
          className="shrink-0 text-caption text-accent underline-offset-2 hover:underline"
          onClick={onClearAll}
        >
          {t('discover_clear_all')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <span key={item.key} className={ACTIVE_FILTER_CHIP_CLASS}>
            <span className="truncate font-weight-label">{item.label}</span>
            <button
              type="button"
              aria-label={item.removeLabel}
              className="shrink-0 rounded-circle p-0.5 text-fg-secondary hover:bg-ghost-surface hover:text-fg"
              onClick={item.onRemove}
            >
              <CloseIcon size={16} />
            </button>
          </span>
        ))}
        {trailing}
      </div>
    </div>
  );
}
