import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BusinessReportClient } from '@/modules/business';
import { fetchOblReport } from '@/modules/business/infrastructure/clients/obl-ledger.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import { reportMetadata } from '@/modules/business/infrastructure/business-metadata.server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reportId: string }>;
}): Promise<Metadata> {
  const { reportId } = await params;
  return reportMetadata(decodeURIComponent(reportId));
}

export default async function BusinessReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { reportId } = await params;
  const detail = await fetchOblReport(decodeURIComponent(reportId));
  if (!detail) {
    notFound();
  }
  return <BusinessReportClient username={username} detail={detail} />;
}
