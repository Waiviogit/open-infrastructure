import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BusinessDisputeClient } from '@/modules/business';
import { fetchOblDispute } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import { disputeMetadata } from '@/modules/business/infrastructure/business-metadata.server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}): Promise<Metadata> {
  const { disputeId } = await params;
  return disputeMetadata(decodeURIComponent(disputeId));
}

export default async function BusinessDisputePage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { disputeId } = await params;
  const detail = await fetchOblDispute(decodeURIComponent(disputeId));
  if (!detail) {
    notFound();
  }
  return <BusinessDisputeClient username={username} detail={detail} />;
}
