import type { Metadata } from 'next';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { InstacartWaitView } from '@/modules/object/presentation/components/instacart-wait-view';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return {
    title: messages.Instacart_Recipe_Loading ?? 'Your recipe is loading',
    robots: { index: false, follow: false },
  };
}

export default async function InstacartWaitPage({
  params,
}: {
  params: Promise<{ 'object-id': string }>;
}) {
  const { 'object-id': rawId } = await params;
  const objectId = decodeURIComponent(rawId);
  return <InstacartWaitView objectId={objectId} />;
}
