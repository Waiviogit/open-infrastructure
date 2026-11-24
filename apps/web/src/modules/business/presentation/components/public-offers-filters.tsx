'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CloseIcon, SearchIcon } from '@/icons';
import { MobileFilterButton, MobileFilterSheet } from '@/shared/presentation';

import {
  buildPublicOffersHref,
  hasPublicOffersFilters,
  type PublicOffersPageState,
} from '../../domain/public-offers-url';
import { BusinessButton } from '../ui/business-button';
import { BusinessField } from '../ui/business-field';
import { BUSINESS_FIELD_CLASS, BUSINESS_FOCUS_RING } from '../ui/classes';

type Kind = 'offer' | 'request';

function useCatalogFilterDraft(kind: Kind, filters: PublicOffersPageState) {
  const router = useRouter();
  const [author, setAuthor] = useState(filters.author);
  const [q, setQ] = useState(filters.q);

  useEffect(() => {
    setAuthor(filters.author);
    setQ(filters.q);
  }, [filters.author, filters.q]);

  function apply() {
    router.push(
      buildPublicOffersHref(kind, {
        author: author.trim() || undefined,
        q: q.trim() || undefined,
      }),
    );
  }

  function clear() {
    setAuthor('');
    setQ('');
    router.push(buildPublicOffersHref(kind));
  }

  return { author, setAuthor, q, setQ, apply, clear };
}

type DraftState = ReturnType<typeof useCatalogFilterDraft>;

function CatalogFilterFields({
  kind,
  draft,
}: {
  kind: Kind;
  draft: DraftState;
}) {
  const { t } = useI18n();
  return (
    <>
      <BusinessField label={t('business_public_filter_q')}>
        <input
          type="search"
          value={draft.q}
          onChange={(e) => draft.setQ(e.target.value)}
          placeholder={
            kind === 'offer'
              ? t('business_catalog_search_offers_placeholder')
              : t('business_catalog_search_requests_placeholder')
          }
          className={BUSINESS_FIELD_CLASS}
          autoComplete="off"
          enterKeyHint="search"
        />
      </BusinessField>
      <BusinessField label={t('business_public_filter_author')}>
        <input
          type="text"
          value={draft.author}
          onChange={(e) => draft.setAuthor(e.target.value)}
          placeholder={t('business_public_filter_author_placeholder')}
          className={BUSINESS_FIELD_CLASS}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </BusinessField>
    </>
  );
}

/** Desktop rail: search + author, submitted with Enter or the button. */
export function CatalogFilterForm({
  kind,
  filters,
}: {
  kind: Kind;
  filters: PublicOffersPageState;
}) {
  const { t } = useI18n();
  const draft = useCatalogFilterDraft(kind, filters);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    draft.apply();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" role="search">
      <p className="px-2 text-caption font-weight-label uppercase tracking-loose text-fg-tertiary">
        {t('business_catalog_filters_title')}
      </p>
      <CatalogFilterFields kind={kind} draft={draft} />
      <div className="flex flex-wrap gap-2">
        <BusinessButton type="submit" variant="primary" size="sm">
          <SearchIcon size={16} />
          {t('business_public_filter_apply')}
        </BusinessButton>
        {hasPublicOffersFilters(filters) ? (
          <BusinessButton variant="ghost" size="sm" onClick={draft.clear}>
            {t('business_public_filter_clear')}
          </BusinessButton>
        ) : null}
      </div>
    </form>
  );
}

/** Below `lg`: the shared Filter pill + bottom sheet (Discover / Favorites pattern). */
export function CatalogMobileFilters({
  kind,
  filters,
}: {
  kind: Kind;
  filters: PublicOffersPageState;
}) {
  const draft = useCatalogFilterDraft(kind, filters);
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <MobileFilterButton onClick={() => setOpen(true)} expanded={open} />
      <MobileFilterSheet
        open={open}
        onClose={() => {
          setOpen(false);
          draft.apply();
        }}
        onClear={() => {
          setOpen(false);
          draft.clear();
        }}
      >
        <form
          className="flex flex-col gap-3 px-gutter py-card-padding"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            draft.apply();
          }}
        >
          <CatalogFilterFields kind={kind} draft={draft} />
        </form>
      </MobileFilterSheet>
    </div>
  );
}

const CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1 rounded-pill border border-border bg-surface-control py-0.5 pe-1 ps-2 text-caption text-fg';

/** Applied filters as removable chips above the results (Discover pattern). */
export function CatalogActiveFilters({
  kind,
  filters,
}: {
  kind: Kind;
  filters: PublicOffersPageState;
}) {
  const { t } = useI18n();
  const router = useRouter();
  if (!hasPublicOffersFilters(filters)) {
    return null;
  }

  function hrefWithout(field: 'author' | 'q'): string {
    return buildPublicOffersHref(kind, {
      author: field === 'author' ? undefined : filters.author || undefined,
      q: field === 'q' ? undefined : filters.q || undefined,
    });
  }

  const chips: Array<{ field: 'author' | 'q'; label: string }> = [];
  if (filters.q) {
    chips.push({ field: 'q', label: `“${filters.q}”` });
  }
  if (filters.author) {
    chips.push({ field: 'author', label: `@${filters.author}` });
  }

  return (
    <div
      className="mb-card-padding flex flex-wrap items-center gap-1.5"
      aria-label={t('business_catalog_active_filters')}
    >
      {chips.map((chip) => (
        <span key={chip.field} className={CHIP_CLASS}>
          <span className="min-w-0 truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => router.push(hrefWithout(chip.field))}
            aria-label={t('business_catalog_remove_filter', {
              filter: chip.label,
            })}
            className={`inline-flex size-5 shrink-0 items-center justify-center rounded-circle text-fg-secondary hover:bg-surface hover:text-fg ${BUSINESS_FOCUS_RING}`}
          >
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => router.push(buildPublicOffersHref(kind))}
        className={`ms-1 rounded-btn text-caption text-accent underline-offset-2 hover:underline ${BUSINESS_FOCUS_RING}`}
      >
        {t('business_public_filter_clear')}
      </button>
    </div>
  );
}
