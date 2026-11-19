'use client';

import Link from 'next/link';
import { useCallback, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { BriefcaseIcon, HandHelpingIcon, StoreIcon } from '@/icons';
import {
  useInfiniteScroll,
  useSyncedPaginatedList,
} from '@/shared/presentation';

import {
  buildPublicOffersHref,
  hasPublicOffersFilters,
  type PublicOffersPageState,
} from '../../domain/public-offers-url';
import type { OblOffsetPage } from '../../domain/obl-pagination.types';
import { businessRoutes } from '../../domain/routes';
import { loadMorePublicOffersAction } from '../../infrastructure/actions/load-more-obl.server';
import type { OblOfferApiRow } from '../../infrastructure/clients/obl-offers.server';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessRailNav } from '../ui/business-context-rail';
import { BusinessEmptyState, BusinessErrorState } from '../ui/business-states';
import { businessButtonClass } from '../ui/classes';
import { OfferCard } from './offer-card';
import {
  CatalogActiveFilters,
  CatalogFilterForm,
  CatalogMobileFilters,
} from './public-offers-filters';

const RAIL_ICON_SIZE = 16;

export function PublicOffersListClient({
  initialPage,
  kind,
  filters,
  loadFailed = false,
}: {
  initialPage: OblOffsetPage<OblOfferApiRow>;
  kind: 'offer' | 'request';
  filters: PublicOffersPageState;
  loadFailed?: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const { items, setItems, hasMore, setHasMore } =
    useSyncedPaginatedList(initialPage);

  const hasFilters = hasPublicOffersFilters(filters);
  const tabQuery = {
    author: filters.author || undefined,
    q: filters.q || undefined,
  };

  const onLoadMore = useCallback(() => {
    if (!hasMore || pending) {
      return;
    }
    startTransition(async () => {
      const next = await loadMorePublicOffersAction({
        kind,
        offset: items.length,
        author: filters.author || undefined,
        q: filters.q || undefined,
      });
      setItems((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
    });
  }, [
    filters.author,
    filters.q,
    hasMore,
    items.length,
    kind,
    pending,
    setHasMore,
    setItems,
  ]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: pending,
    onLoadMore,
  });

  const kindLabel =
    kind === 'offer'
      ? t('business_public_offers_title')
      : t('business_public_requests_title');
  const kindItems = [
    {
      id: 'offer',
      href: buildPublicOffersHref('offer', tabQuery),
      label: t('business_public_offers_title'),
      icon: <BriefcaseIcon size={RAIL_ICON_SIZE} />,
    },
    {
      id: 'request',
      href: buildPublicOffersHref('request', tabQuery),
      label: t('business_public_requests_title'),
      icon: <HandHelpingIcon size={RAIL_ICON_SIZE} />,
    },
  ];

  function body() {
    if (loadFailed) {
      return <BusinessErrorState />;
    }
    if (items.length === 0 && hasFilters) {
      return (
        <BusinessEmptyState
          title={t('business_catalog_no_matches_title')}
          description={
            kind === 'offer'
              ? t('business_public_offers_empty_filtered')
              : t('business_public_requests_empty_filtered')
          }
          action={
            <Link
              href={buildPublicOffersHref(kind)}
              className={businessButtonClass({ variant: 'secondary' })}
              suppressHydrationWarning
            >
              {t('business_public_filter_clear')}
            </Link>
          }
        />
      );
    }
    if (items.length === 0) {
      return (
        <BusinessEmptyState
          icon={<StoreIcon size={20} />}
          title={
            kind === 'offer'
              ? t('business_catalog_empty_offers_title')
              : t('business_catalog_empty_requests_title')
          }
          description={
            kind === 'offer'
              ? t('business_catalog_empty_offers_body')
              : t('business_catalog_empty_requests_body')
          }
          action={
            <Link
              href={businessRoutes.manageNew(kind)}
              className={businessButtonClass({ variant: 'primary' })}
              suppressHydrationWarning
            >
              {kind === 'offer'
                ? t('business_create_offer')
                : t('business_create_request')}
            </Link>
          }
        />
      );
    }
    return (
      <>
        <ul className="flex flex-col gap-card-padding">
          {items.map((offer) => (
            <li key={`${offer.offer_id}-${offer.version}`}>
              <OfferCard
                offer={offer}
                href={
                  kind === 'offer'
                    ? businessRoutes.publicOffer(offer.offer_id, offer.version)
                    : businessRoutes.publicRequest(
                        offer.offer_id,
                        offer.version,
                      )
                }
              />
            </li>
          ))}
        </ul>
        <div ref={sentinelRef} className="h-4" aria-hidden />
      </>
    );
  }

  return (
    <BusinessPageShell
      title={t('app_section_nav_business')}
      subtitle={t('business_discover_subtitle')}
      railLabel={kindLabel}
      rail={
        <>
          <BusinessRailNav
            items={kindItems}
            activeId={kind}
            ariaLabel={t('business_catalog_kind_aria')}
          />
          <div className="hidden lg:block">
            <CatalogFilterForm kind={kind} filters={filters} />
          </div>
        </>
      }
      mobileControls={<CatalogMobileFilters kind={kind} filters={filters} />}
    >
      <CatalogActiveFilters kind={kind} filters={filters} />
      {body()}
    </BusinessPageShell>
  );
}
