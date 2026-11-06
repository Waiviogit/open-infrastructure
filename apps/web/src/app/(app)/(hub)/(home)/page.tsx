import type { Metadata } from 'next';

import { HOME_FEED_PAGE_SIZE, HomeFeedPostsList } from '@/modules/home';
import { getHomeFeedPageQuery } from '@/modules/home/application/queries/get-home-feed-page.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from './home-feed-metadata';

export const dynamic = 'force-dynamic';

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
