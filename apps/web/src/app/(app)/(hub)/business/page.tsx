import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { businessRoutes } from '@/modules/business/domain/routes';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return { title: messages.business_title ?? 'Business' };
}

export default function BusinessRootPage() {
  redirect(businessRoutes.discoverOffers);
}
