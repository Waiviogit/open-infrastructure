import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getUserHeadQuery } from '@/modules/user-profile/application/queries/get-user-head.query';
import { isProfileAccountSegment } from '@/modules/user-profile/domain/profile-account-segment';

import UserProfileNameLoading from './loading';

/**
 * Existence check behind the entry skeleton, on the cheap profile head (indexed account row, no
 * live chain call; the `(profile)` layout reuses the same read for the hero). A malformed name gets
 * a real 404 from `proxy.ts`; an unknown well-formed account streams the not-found UI with
 * `noindex` (HTTP 200). Only a definite 404 decides: an unavailable query-api renders on, so a
 * failed read cached into a link prefetch never turns into "not found".
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
  const head = await getUserHeadQuery(decodeURIComponent(name));
  if (head.kind === 'missing') {
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
