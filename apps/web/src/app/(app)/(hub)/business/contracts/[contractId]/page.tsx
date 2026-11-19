import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BusinessContractClient } from '@/modules/business';
import { fetchOblContract } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import { contractMetadata } from '@/modules/business/infrastructure/business-metadata.server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ contractId: string }>;
}): Promise<Metadata> {
  const { contractId } = await params;
  return contractMetadata(decodeURIComponent(contractId));
}

export default async function BusinessContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { contractId } = await params;
  const contract = await fetchOblContract(decodeURIComponent(contractId));
  if (!contract) {
    notFound();
  }
  return <BusinessContractClient username={username} contract={contract} />;
}
