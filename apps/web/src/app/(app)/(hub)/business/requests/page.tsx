import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { OBL_LIST_PAGE_SIZE } from '@/modules/business/domain/obl-pagination.types';
import { parsePublicOffersPageState } from '@/modules/business/domain/public-offers-url';
import { BusinessPageSkeleton } from '@/modules/business/presentation/ui/business-page-skeleton';
import { PublicOffersListClient } from '@/modules/business/presentation/components/public-offers-list-client';
import { searchOblOffers } from '@/modules/business/infrastructure/clients/obl-offers.server';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return { title: messages.business_public_requests_title ?? 'Requests' };
}

/** Body streams behind the skeleton: `business/loading.tsx` is shared with the sibling tab. */
export default function BusinessDiscoverRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<BusinessPageSkeleton />}>
      <BusinessDiscoverRequestsBody searchParams={searchParams} />
    </Suspense>
  );
}

async function BusinessDiscoverRequestsBody({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parsePublicOffersPageState(await searchParams);
  const [page, viewer] = await Promise.all([
    searchOblOffers({
      kind: 'request',
      author: filters.author || undefined,
      q: filters.q || undefined,
      limit: OBL_LIST_PAGE_SIZE,
    }),
    getRequestUser(),
  ]);
  return (
    <PublicOffersListClient
      initialPage={page ?? { items: [], hasMore: false }}
      loadFailed={page === null}
      kind="request"
      filters={filters}
      signedIn={viewer !== null}
    />
  );
}
