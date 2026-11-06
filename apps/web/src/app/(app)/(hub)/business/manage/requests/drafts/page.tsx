import type { Metadata } from 'next';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { BusinessOffersListPage } from '@/modules/business/presentation/business-offers-list-page';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return { title: messages.business_requests_title ?? 'Requests' };
}

export default function BusinessRequestsDraftsPage() {
  return <BusinessOffersListPage kind="request" tab="drafts" />;
}
