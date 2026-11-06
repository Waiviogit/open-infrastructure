import type { Metadata } from 'next';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { HomeFeedGuestPrompt, HomeThreadsFeedList } from '@/modules/home';
import { getHomeThreadsFeedPageQuery } from '@/modules/home/application/queries/get-home-followed-feeds.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

import { buildHomeFeedTabMetadata } from '../../home-feed-metadata';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return buildHomeFeedTabMetadata();
}

export default async function HomeThreadsFeedPage() {
  const user = await getRequestUser();
  const account = user?.username ?? null;
  if (!account) {
    return (
      <main className="min-w-0 pb-section-y">
        <HomeFeedGuestPrompt />
      </main>
    );
  }

  const initialPage = await getHomeThreadsFeedPageQuery({
    account,
    locale: await getRequestLocale(),
  });

  return (
    <main className="min-w-0 pb-section-y">
      <HomeThreadsFeedList initialPage={initialPage} currentUsername={account} />
    </main>
  );
}
