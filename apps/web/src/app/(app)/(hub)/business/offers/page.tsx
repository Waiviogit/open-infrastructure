import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { OBL_LIST_PAGE_SIZE } from '@/modules/business/domain/obl-pagination.types';
import { parsePublicOffersPageState } from '@/modules/business/domain/public-offers-url';
import { BusinessContentSkeleton } from '@/modules/business/presentation/components/business-content-skeleton';
import { PublicOffersListClient } from '@/modules/business/presentation/components/public-offers-list-client';
import { searchOblOffers } from '@/modules/business/infrastructure/clients/obl-offers.server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return { title: messages.business_public_offers_title ?? 'Offers' };
}

/** Body streams behind the skeleton: `business/loading.tsx` is shared with the sibling tab. */
export default function BusinessDiscoverOffersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<BusinessContentSkeleton />}>
      <BusinessDiscoverOffersBody searchParams={searchParams} />
    </Suspense>
  );
}

async function BusinessDiscoverOffersBody({ searchParams }: { searchParams: SearchParams }) {
  const filters = parsePublicOffersPageState(await searchParams);
  const page = await searchOblOffers({
    kind: 'offer',
    author: filters.author || undefined,
    q: filters.q || undefined,
    limit: OBL_LIST_PAGE_SIZE,
  });
  return (
    <PublicOffersListClient
      initialPage={page ?? { items: [], hasMore: false }}
      kind="offer"
      filters={filters}
    />
  );
}
