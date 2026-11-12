import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import {
  EditorScreen,
  type LastDraftSidebarItem,
} from '@/modules/editor';
import {
  getPostEditorDefaultBeneficiary,
  isPostEditorGooglePlacesEnabled,
} from '@/config/post-editor-defaults';
import { editorJsonMetadataFromPublishedPost } from '@/modules/editor/application/post-publish-operations';
import type { PostEditTarget } from '@/modules/editor/domain/post-edit-target';
import { fetchPublishedPostForEdit } from '@/modules/editor/infrastructure/fetch-published-post-for-edit.server';
import { EditorNotAPostNotice } from '@/modules/editor/presentation/components/editor-not-a-post-notice';
import { fetchUserPostDraftForEditor } from '@/modules/editor/infrastructure/fetch-user-post-draft.server';
import { fetchUserDraftListServer } from '@/modules/editor/infrastructure/query-api-drafts.server';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return {
    title: messages.editor,
  };
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{
    author?: string;
    permlink?: string;
    draftId?: string;
  }>;
}) {
  const auth = createCookieAuthContextProvider();
  const user = await auth.getUser();
  if (!user) {
    redirect('/');
  }

  const sp = await searchParams;
  const authorParam = typeof sp.author === 'string' ? sp.author.trim() : '';
  if (
    authorParam &&
    authorParam.toLowerCase() !== user.username.toLowerCase()
  ) {
    redirect('/');
  }

  const permlink = typeof sp.permlink === 'string' ? sp.permlink.trim() : '';
  const draftIdParam =
    typeof sp.draftId === 'string' ? sp.draftId.trim() : '';

  let initialDraft: Awaited<
    ReturnType<typeof fetchUserPostDraftForEditor>
  > = null;
  if (draftIdParam) {
    initialDraft = await fetchUserPostDraftForEditor(user.username, {
      draftId: draftIdParam,
    });
  } else if (permlink) {
    initialDraft = await fetchUserPostDraftForEditor(user.username, {
      permlink,
    });
  }

  /** `?author=<me>&permlink=<p>` without a saved edit draft → start from the published post. */
  const publishedResult =
    !initialDraft && permlink ? await fetchPublishedPostForEdit(user.username, permlink) : null;
  if (publishedResult && !publishedResult.ok && publishedResult.error === 'not_a_post') {
    const messages = await loadMessages(await getRequestLocale());
    return <EditorNotAPostNotice message={messages.editor_not_a_post_notice} />;
  }
  const publishedPost = publishedResult?.ok ? publishedResult.value : null;

  const editTarget: PostEditTarget | null = initialDraft?.permlink
    ? initialDraft.parentPermlink
      ? { permlink: initialDraft.permlink, parentPermlink: initialDraft.parentPermlink }
      : null
    : publishedPost
      ? { permlink: publishedPost.permlink, parentPermlink: publishedPost.parentPermlink }
      : null;

  let sidebarDrafts: LastDraftSidebarItem[] = [];
  const listRes = await fetchUserDraftListServer(user.username, { limit: 5 });
  if (listRes.ok) {
    sidebarDrafts = listRes.value.items.map((d) => ({
      draftId: d.draftId,
      title: d.title,
      lastUpdated: d.lastUpdated,
    }));
  }

  const screenKey =
    initialDraft?.draftId ?? (permlink ? `p:${permlink}` : 'new');

  return (
    <Suspense fallback={null}>
      <EditorScreen
        key={screenKey}
        username={user.username}
        initialTitle={initialDraft?.title ?? publishedPost?.title ?? ''}
        initialBody={initialDraft?.body ?? publishedPost?.body ?? ''}
        initialDraftId={initialDraft?.draftId ?? null}
        initialJsonMetadata={
          initialDraft?.jsonMetadata ??
          (publishedPost ? editorJsonMetadataFromPublishedPost(publishedPost.jsonMetadata) : null)
        }
        editTarget={editTarget}
        googlePlacesEnabled={isPostEditorGooglePlacesEnabled()}
        defaultBeneficiary={getPostEditorDefaultBeneficiary()}
        initialBeneficiaries={initialDraft?.beneficiaries ?? null}
        sidebarDrafts={sidebarDrafts}
      />
    </Suspense>
  );
}
