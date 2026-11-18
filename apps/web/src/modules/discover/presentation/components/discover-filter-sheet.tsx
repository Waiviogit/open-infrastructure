'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { SearchIcon } from '@/icons';
import { MobileFilterSheet, useInstantNavigation } from '@/shared/presentation';

import { buildDiscoverHref, type DiscoverBox, type DiscoverMapView } from '../../domain/discover-url';
import { useDiscoverTagCategories } from '../hooks/use-discover-tag-categories';
import { DiscoverFilterSections } from './discover-filter-sections';

const FILTER_DEBOUNCE_MS = 300;

export type DiscoverFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  objectType: string;
  q: string;
  tags: string[];
  sort: 'newest' | 'oldest' | 'rank';
  box: DiscoverBox | null;
  map: DiscoverMapView | null;
};

export function DiscoverFilterSheet({
  open,
  onClose,
  objectType,
  q,
  tags,
  sort,
  box,
  map,
}: DiscoverFilterSheetProps) {
  const { t } = useI18n();
  const { navigateInstant } = useInstantNavigation();
  const [filterSearch, setFilterSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { loading, orderedSections, collapsedCategories, toggleCollapse } =
    useDiscoverTagCategories({ objectType, q, tags, box });

  useEffect(() => {
    if (!open) {
      setFilterSearch('');
    }
  }, [open]);

  const pushTags = useCallback(
    (nextTags: string[], nextQ = q) => {
      const href = buildDiscoverHref({
        type: objectType,
        q: nextQ,
        tags: nextTags,
        sort,
        box,
        map: map ?? undefined,
      });
      navigateInstant({ href, method: 'replace', scroll: false });
    },
    [navigateInstant, objectType, q, sort, box, map],
  );

  const onToggleTag = useCallback(
    (value: string, checked: boolean) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      const next = checked ? [...tags, value] : tags.filter((tag) => tag !== value);
      debounceRef.current = setTimeout(() => {
        pushTags(next);
        debounceRef.current = null;
      }, FILTER_DEBOUNCE_MS);
    },
    [tags, pushTags],
  );

  const onClear = () => {
    pushTags([], '');
  };

  return (
    <MobileFilterSheet
      open={open}
      onClose={onClose}
      onClear={onClear}
      headerExtra={
        <div className="relative mt-3 flex items-center gap-2 rounded-btn border border-border bg-surface-control px-3 py-2">
          <SearchIcon size={18} className="shrink-0 text-fg-secondary" />
          <input
            type="search"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder={t('discover_search_filters')}
            className="min-w-0 flex-1 border-0 bg-transparent text-body text-fg outline-none placeholder:text-fg-tertiary"
          />
        </div>
      }
    >
      <div className="px-gutter py-3">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-btn bg-surface-control" aria-hidden />
            ))}
          </div>
        ) : (
          <DiscoverFilterSections
            sections={orderedSections}
            tags={tags}
            collapsedCategories={collapsedCategories}
            onToggleCollapse={toggleCollapse}
            onToggleTag={onToggleTag}
            itemSearchQuery={filterSearch}
          />
        )}
      </div>
    </MobileFilterSheet>
  );
}
