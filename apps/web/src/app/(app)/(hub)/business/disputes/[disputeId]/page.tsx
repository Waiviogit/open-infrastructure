import { notFound } from 'next/navigation';

import { BusinessDisputeClient } from '@/modules/business';
import { fetchOblDispute } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

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
