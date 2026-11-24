'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { ProjectedObjectView } from '@/modules/feed/application/dto/object-fields';
import { CategorySectionCard } from '@/modules/feed/presentation';
import { useInfiniteScroll } from '@/shared/presentation';
import type { CategoryHrefFor } from '@/shared/presentation/category-nav';
import { FeedColumn } from '@/shared/presentation/layout';
import { isScrollRestorePending } from '@/shared/presentation/navigation/scroll-memory';

import type { DiscoverSection } from '../../domain/discover-response.schema';
import { fetchDiscoverSections } from '../../infrastructure/discover.client';
import { DiscoverCategoryLink } from './discover-category-nav';
import {
  discoverSectionsCacheKey,
  readDiscoverSectionsCache,
  writeDiscoverSectionsCache,
} from '../../infrastructure/discover-feed-cache';

/** Category blocks per request (the first page fills the viewport; more load on scroll). */
const SECTIONS_PER_PAGE = 3;

/** Joins lineage segments into one dependency key (a control character never in a name). */
const LINEAGE_SEPARATOR = '\u0001';

export type DiscoverSectionsProps = {
  objectType: string;
  /** Category with subcategories (non-empty lineage). */
  categoryPath: readonly string[];
  hrefFor: CategoryHrefFor;
  viewerUsername?: string | null;
  onRequireLogin?: () => void;
};

/**
 * Center column of a Discover category that has subcategories: one `CategorySectionCard` per
 * child category (top objects by rank, group count, Show more). More blocks load on scroll; a Back
 * navigation seeds the loaded blocks from the session cache so the scroll offset can be restored.
 */
export function DiscoverSections({
  objectType,
  categoryPath,
  hrefFor,
  viewerUsername,
  onRequireLogin,
}: DiscoverSectionsProps) {
  const { t } = useI18n();
  // The lineage array is rebuilt on every URL change (sort, map); key the fetch by its content.
  const pathKey = categoryPath.join(LINEAGE_SEPARATOR);
  const lineage = useMemo(
    () => (pathKey.length > 0 ? pathKey.split(LINEAGE_SEPARATOR) : []),
    [pathKey],
  );
  const cacheKey = discoverSectionsCacheKey(objectType, lineage);
  const [cachedOnRestore] = useState(() =>
    isScrollRestorePending() ? readDiscoverSectionsCache(cacheKey) : null,
  );
  const skipInitialFetch = useRef(cachedOnRestore != null);
  const [sections, setSections] = useState<DiscoverSection[]>(
    () => cachedOnRestore?.sections ?? [],
  );
  const [cursor, setCursor] = useState<string | null>(
    cachedOnRestore?.cursor ?? null,
  );
  const [hasMore, setHasMore] = useState(cachedOnRestore?.hasMore ?? false);
  const [loading, setLoading] = useState(cachedOnRestore == null);
  const [pending, startTransition] = useTransition();

  const loadPage = useCallback(
    async (
      nextCursor: string | null,
      replace: boolean,
      signal: AbortSignal,
    ) => {
      const page = await fetchDiscoverSections(objectType, {
        categoryPath: lineage,
        cursor: nextCursor,
        sectionLimit: SECTIONS_PER_PAGE,
        signal,
      });
      if (signal.aborted || !page) {
        return;
      }
      let merged: DiscoverSection[] = page.sections;
      setSections((prev) => {
        if (replace) {
          merged = page.sections;
          return merged;
        }
        const seen = new Set(prev.map((section) => section.categoryName));
        merged = [
          ...prev,
          ...page.sections.filter((section) => !seen.has(section.categoryName)),
        ];
        return merged;
      });
      writeDiscoverSectionsCache(cacheKey, {
        sections: merged,
        cursor: page.cursor,
        hasMore: page.hasMore,
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    },
    [cacheKey, lineage, objectType],
  );

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setSections([]);
    setCursor(null);
    setHasMore(false);
    void (async () => {
      await loadPage(null, true, ac.signal);
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [loadPage]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || pending || loading) {
      return;
    }
    startTransition(async () => {
      await loadPage(cursor, false, new AbortController().signal);
    });
  }, [cursor, hasMore, loadPage, loading, pending]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: hasMore && !loading,
    isLoading: pending,
    onLoadMore,
  });

  if (loading) {
    return (
      <FeedColumn>
        <div className="flex flex-col gap-8" aria-busy="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-card border border-border bg-surface-control"
              aria-hidden
            />
          ))}
        </div>
      </FeedColumn>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="text-body-sm text-fg-secondary">
        {t('discover_no_results')}
      </p>
    );
  }

  return (
    <FeedColumn>
      <div className="flex flex-col gap-8">
        {sections.map((section, index) => (
          <CategorySectionCard
            key={section.categoryName}
            headingId={`discover-section-${index}`}
            title={section.categoryName}
            href={hrefFor([...lineage, section.categoryName])}
            totalObjects={section.totalObjects}
            items={section.items as unknown as ProjectedObjectView[]}
            NavLink={DiscoverCategoryLink}
            viewerUsername={viewerUsername}
            onRequireLogin={onRequireLogin}
          />
        ))}
      </div>
      {hasMore ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
          <button
            type="button"
            className="sr-only"
            disabled={pending}
            onClick={onLoadMore}
          >
            {t('profile_shop_load_more_sections')}
          </button>
          {pending ? (
            <p className="text-body-sm text-muted" aria-live="polite">
              {t('discover_loading')}
            </p>
          ) : null}
        </div>
      ) : null}
    </FeedColumn>
  );
}
