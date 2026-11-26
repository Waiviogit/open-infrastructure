import type { Metadata } from 'next';
import { navigation } from 'next/cache';

import { getUserProfileViewQuery } from '@/modules/user-profile';
import { parseProfilePostFilters } from '@/modules/user-profile/domain/profile-post-filters-url';
import {
  buildPersonJsonLd,
  buildProfileMetadata,
  JsonLdScript,
  profileCanonical,
  seoPublicOrigin,
} from '@/seo';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

import { FeedProfileContent } from '../../feed-profile-content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  // Keeps the viewer read and the full profile out of link prefetches (the layout's head is
  // prefetched); on a full page load this resolves at once, so crawlers get blocking metadata.
  await navigation();
  const { name } = await params;
  const accountName = decodeURIComponent(name);
  const auth = createCookieAuthContextProvider();
  const viewer = (await auth.getUser())?.username ?? null;
  const profile = await getUserProfileViewQuery(accountName, viewer);
  if (!profile) {
    return { title: accountName };
  }
  return buildProfileMetadata({
    name: profile.name,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverImageUrl: profile.coverImageUrl,
    reputation: profile.reputation,
  });
}

export default async function UserProfileFeedHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await navigation();
  const { name } = await params;
  const accountName = decodeURIComponent(name);
  const resolvedSearchParams = await searchParams;
  const { objectIds: postFilterObjectIds } = parseProfilePostFilters(resolvedSearchParams);
  const auth = createCookieAuthContextProvider();
  const viewer = (await auth.getUser())?.username ?? null;
  const profile = await getUserProfileViewQuery(accountName, viewer);
  const origin = seoPublicOrigin();
  const jsonLd =
    profile && origin
      ? buildPersonJsonLd(
          {
            name: profile.name,
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            coverImageUrl: profile.coverImageUrl,
            reputation: profile.reputation,
          },
          profileCanonical(origin, profile.name),
        )
      : null;

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <FeedProfileContent
        accountName={accountName}
        feedTab="posts"
        postFilterObjectIds={postFilterObjectIds}
      />
    </>
  );
}
