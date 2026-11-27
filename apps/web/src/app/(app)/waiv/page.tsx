import type { Metadata } from 'next';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { WaivStatsView } from '@/modules/waiv-token';
import { getWaivStatsPageData } from '@/modules/waiv-token/server';

export async function generateMetadata(): Promise<Metadata> {
  const messages = await loadMessages(await getRequestLocale());
  return {
    title: messages.waiv_page_title,
    description: messages.waiv_page_description,
  };
}

export default async function WaivStatsPage() {
  const { stats, chart } = await getWaivStatsPageData();
  return <WaivStatsView stats={stats} chart={chart} />;
}
