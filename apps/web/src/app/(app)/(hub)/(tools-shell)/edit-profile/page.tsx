import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import {
  EditProfilePageClient,
  EditProfileSkeleton,
  profileFormValuesFromProfile,
} from '@/modules/profile-settings';
import {
  currentProfileFromSnapshot,
  loadHiveAccountMetadata,
} from '@/modules/profile-settings/server';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return {
    title: messages.edit_profile,
    robots: { index: false, follow: false },
  };
}

async function EditProfileContent() {
  const user = await createCookieAuthContextProvider().getUser();
  if (!user) {
    redirect('/sign-in');
  }
  const username = user.username.trim().toLowerCase();
  const snapshot = await loadHiveAccountMetadata(username);
  if (!snapshot) {
    // An empty form would look like a wiped profile; ask for a reload instead.
    const messages = await loadMessages(await getRequestLocale());
    return (
      <p role="alert" className="text-body text-fg-muted">
        {messages.profile_load_error}
      </p>
    );
  }

  return (
    <EditProfilePageClient
      username={username}
      initialValues={profileFormValuesFromProfile(currentProfileFromSnapshot(snapshot))}
    />
  );
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={<EditProfileSkeleton />}>
      <EditProfileContent />
    </Suspense>
  );
}
