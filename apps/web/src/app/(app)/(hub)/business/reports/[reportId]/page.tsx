import { notFound } from 'next/navigation';

import { BusinessReportClient } from '@/modules/business';
import { fetchOblReport } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function BusinessReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireBusinessUser();
  const { reportId } = await params;
  const detail = await fetchOblReport(decodeURIComponent(reportId));
  if (!detail) {
    notFound();
  }
  return <BusinessReportClient detail={detail} />;
}
