import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { DiscoverPageClient } from '@/modules/discover/presentation/components/discover-page-client';
import { getCookieDiscoverObjectType } from '@/modules/discover/domain/discover-type-cookie.server';
import { buildDiscoverMetadata } from '@/seo';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return buildDiscoverMetadata({ locale, messages });
}

/**
 * Request-time reads stream behind `discover/loading.tsx` (the prefetched shell on entry).
 * Bare `/discover` (no type) is redirected in `proxy.ts`; the client reads filters from the URL.
 */
export default async function DiscoverPage() {
  const auth = createCookieAuthContextProvider();
  const [user, rememberedObjectType] = await Promise.all([
    auth.getUser(),
    getCookieDiscoverObjectType(),
  ]);
  return (
    <Suspense fallback={null}>
      <DiscoverPageClient
        viewerUsername={user?.username ?? null}
        rememberedObjectType={rememberedObjectType}
      />
    </Suspense>
  );
}
