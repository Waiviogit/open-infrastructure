import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { BlogPostScreen, getSinglePostQuery, PostInterceptModalShell } from '@/modules/feed';
import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';
import { FeedColumn } from '@/shared/presentation/layout';

import ModalLoadingSkeleton from '../../../../loading';

type PostModalParams = Promise<{ name: string; permlink: string }>;

async function PostModalContent({ params }: { params: PostModalParams }) {
  const auth = createCookieAuthContextProvider();
  const [{ name, permlink }, locale, currentUser] = await Promise.all([
    params,
    getRequestLocale(),
    auth.getUser(),
  ]);
  const accountName = decodeURIComponent(name);
  const permlinkDecoded = decodeURIComponent(permlink);
  const post = await getSinglePostQuery(
    accountName,
    permlinkDecoded,
    locale,
    currentUser?.username ?? null,
  );
  if (!post) {
    notFound();
  }

  return (
    <PostInterceptModalShell>
      <FeedColumn>
        <BlogPostScreen
          variant="modal"
          story={post.story}
          bodyHtmlSafe={post.bodyHtmlSafe}
          currentUsername={currentUser?.username ?? null}
        />
      </FeedColumn>
    </PostInterceptModalShell>
  );
}

/**
 * Intercepts soft navigation to `/user-profile/[name]/post/[permlink]`.
 * Posts live under a static `post` segment so profile tabs (`threads`, etc.) are not mistaken
 * for permalinks by this parallel route (which would load getSinglePostQuery and 404).
 * The post (viewer, locale, query) streams behind the modal skeleton, so the click paints it at once.
 *
 * Public URLs stay `/@account/permlink`; {@link proxy} rewrites them to `.../post/permlink`.
 */
export default function PostModalInterceptPage({ params }: { params: PostModalParams }) {
  return (
    <Suspense fallback={<ModalLoadingSkeleton />}>
      <PostModalContent params={params} />
    </Suspense>
  );
}
