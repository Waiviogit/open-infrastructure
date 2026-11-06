import type { Metadata } from 'next';

import { HOME_FEED_PAGE_SIZE, HomeFeedPostsList } from '@/modules/home';
import { getHomeFeedPageQuery } from '@/modules/home/application/queries/get-home-feed-page.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from './home-feed-metadata';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeFeedTabMetadata();
}

export default async function Index() {
  const user = await getRequestUser();
  const viewer = user?.username ?? null;
  const initialPage = await getHomeFeedPageQuery({ limit: HOME_FEED_PAGE_SIZE }, viewer);

  return (
    <main className="min-w-0 pb-section-y">
      <HomeFeedPostsList initialPage={initialPage} currentUsername={viewer} />
    </main>
  );
}
