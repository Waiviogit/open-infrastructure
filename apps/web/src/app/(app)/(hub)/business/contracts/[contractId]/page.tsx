import { notFound } from 'next/navigation';

import { BusinessContractClient } from '@/modules/business';
import { fetchOblContract } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function BusinessContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  await requireBusinessUser();
  const { contractId } = await params;
  const contract = await fetchOblContract(decodeURIComponent(contractId));
  if (!contract) {
    notFound();
  }
  return <BusinessContractClient contract={contract} />;
}
