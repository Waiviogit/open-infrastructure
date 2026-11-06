import { notFound } from 'next/navigation';

import { BusinessInvoiceClient } from '@/modules/business';
import { fetchOblInvoice } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function BusinessInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  await requireBusinessUser();
  const { invoiceId } = await params;
  const detail = await fetchOblInvoice(decodeURIComponent(invoiceId));
  if (!detail) {
    notFound();
  }
  return <BusinessInvoiceClient detail={detail} />;
}
