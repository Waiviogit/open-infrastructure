import type { Metadata } from 'next';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { buildHomeMetadata } from '@/seo';

/** Every hub feed tab shares the home metadata; canonical points at `/`. */
export async function buildHomeFeedTabMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return buildHomeMetadata({ locale, messages });
}
