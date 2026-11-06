import { notFound } from 'next/navigation';

import { BusinessServiceOrderClient } from '@/modules/business';
import { fetchOblServiceOrder } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function BusinessServiceOrderPage({
  params,
}: {
  params: Promise<{ serviceOrderId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { serviceOrderId } = await params;
  const detail = await fetchOblServiceOrder(decodeURIComponent(serviceOrderId));
  if (!detail) {
    notFound();
  }
  return <BusinessServiceOrderClient username={username} detail={detail} />;
}
