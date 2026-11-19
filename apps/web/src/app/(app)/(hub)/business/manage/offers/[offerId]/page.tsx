import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BusinessOfferDetailClient } from '@/modules/business';
import { fetchOblOffer } from '@/modules/business/infrastructure/clients/obl-offers.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import { ownerOfferMetadata } from '@/modules/business/infrastructure/business-metadata.server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ offerId: string }>;
}): Promise<Metadata> {
  const { offerId } = await params;
  return ownerOfferMetadata(offerId);
}

export default async function BusinessOfferDetailPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { offerId } = await params;
  const offer = await fetchOblOffer(offerId);
  if (!offer) {
    notFound();
  }
  return <BusinessOfferDetailClient username={username} offer={offer} />;
}
