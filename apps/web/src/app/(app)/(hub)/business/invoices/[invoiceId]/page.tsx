import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BusinessInvoiceClient } from '@/modules/business';
import { fetchOblInvoice } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import { invoiceMetadata } from '@/modules/business/infrastructure/business-metadata.server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}): Promise<Metadata> {
  const { invoiceId } = await params;
  return invoiceMetadata(decodeURIComponent(invoiceId));
}

export default async function BusinessInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { invoiceId } = await params;
  const detail = await fetchOblInvoice(decodeURIComponent(invoiceId));
  if (!detail) {
    notFound();
  }
  return <BusinessInvoiceClient username={username} detail={detail} />;
}
