import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { InstacartWaitView } from '@/modules/object/presentation/components/instacart-wait-view';

type Params = Promise<{ 'object-id': string }>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return {
    title: messages.Instacart_Recipe_Loading ?? 'Your recipe is loading',
    robots: { index: false, follow: false },
  };
}

/** Opened by a full page load from the Instacart button; the view streams in the same response. */
export default function InstacartWaitPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <InstacartWaitBody params={params} />
    </Suspense>
  );
}

async function InstacartWaitBody({ params }: { params: Params }) {
  const { 'object-id': rawId } = await params;
  return <InstacartWaitView objectId={decodeURIComponent(rawId)} />;
}
