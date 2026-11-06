import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getUserProfileQuery } from '@/modules/user-profile';
import { isProfileAccountSegment } from '@/modules/user-profile/domain/profile-account-segment';

import UserProfileNameLoading from './loading';

/**
 * Existence check behind the entry skeleton. A malformed name gets a real 404 from `proxy.ts`;
 * an unknown well-formed account streams the not-found UI with `noindex` (HTTP 200).
 */
async function ValidatedProfile({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  if (!isProfileAccountSegment(name)) {
    notFound();
  }
  const profile = await getUserProfileQuery(decodeURIComponent(name));
  if (!profile) {
    notFound();
  }
  return <>{children}</>;
}

/**
 * Validates `[name]` for all routes under `/user-profile/[name]/…` (profile shell and articles).
 * Profile hero lives only under `(profile)/layout.tsx`.
 */
export default function UserProfileNameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  return (
    <Suspense fallback={<UserProfileNameLoading />}>
      <ValidatedProfile params={params}>{children}</ValidatedProfile>
    </Suspense>
  );
}
