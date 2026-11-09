import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { SignInCard } from '@/modules/auth/presentation/components/sign-in-card';
import { buildSignInMetadata } from '@/seo';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return buildSignInMetadata({ locale, messages });
}

/**
 * The card is the static shell. A signed-in visitor is sent home from behind `<Suspense>` (a client
 * redirect): a cookie-presence check in `proxy.ts` would lock out a visitor whose token is invalid.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-container-narrow rounded-card-lg border border-border bg-surface p-card-padding shadow-card-float">
        <SignInCard />
      </div>
      <Suspense>
        <RedirectSignedInVisitor />
      </Suspense>
    </div>
  );
}

async function RedirectSignedInVisitor() {
  const user = await createCookieAuthContextProvider().getUser();
  if (user) {
    redirect('/');
  }
  return null;
}
