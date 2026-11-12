'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { getHiveJsonMetadataDefaults } from '@/config/hive-json-metadata-public';
import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { CompactComposeEditor, editorBodyToMarkdown } from '@/modules/editor';
import {
  buildCommentOp,
  getWalletFacade,
  useHydrateWalletProvider,
} from '@/modules/auth';
import { awaitTrxConfirmation } from '@/modules/notifications';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import {
  revalidateHomeFeedAfterBroadcast,
  revalidateUserFeedAfterBroadcast,
} from '@/shared/infrastructure/query/revalidate-after-broadcast.server';
import { buildHiveJsonMetadataString, createCommentPermlink } from '@/shared';

import { buildCommentEditOp } from '../../application/build-comment-edit-op';
import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import type { CommentEditTarget } from '../../domain/comment-edit-target';

export type StoryCommentEditorProps = {
  story: FeedStoryView;
  currentUsername: string;
  parentAuthor?: string;
  parentPermlink?: string;
  onSubmitted?: () => void;
  onBroadcastRevalidate?: () => Promise<void>;
  /**
   * Edit this published comment or thread in place: the editor starts from its markdown and Save
   * re-broadcasts it with the same author, permlink and parent.
   */
  editTarget?: CommentEditTarget;
  /** Edit mode: leave without saving. */
  onCancel?: () => void;
  /** Edit mode: the edit was broadcast and the page refreshed. */
  onSaved?: () => void;
};

function buildReplyOp(
  story: FeedStoryView,
  currentUsername: string,
  body: string,
  parentAuthor: string | undefined,
  parentPermlink: string | undefined,
) {
  const defaults = getHiveJsonMetadataDefaults();
  const json_metadata = buildHiveJsonMetadataString({
    host: window.location.host,
    ...defaults,
  });
  const replyParentAuthor = parentAuthor ?? story.authorName;
  const replyParentPermlink = parentPermlink ?? story.permlink;
  return buildCommentOp({
    parent_author: replyParentAuthor,
    parent_permlink: replyParentPermlink,
    author: currentUsername,
    permlink: createCommentPermlink(replyParentAuthor, replyParentPermlink),
    title: '',
    body,
    json_metadata,
  });
}

export function StoryCommentEditor({
  story,
  currentUsername,
  parentAuthor,
  parentPermlink,
  onSubmitted,
  onBroadcastRevalidate,
  editTarget,
  onCancel,
  onSaved,
}: StoryCommentEditorProps) {
  useHydrateWalletProvider();
  const router = useRouter();
  const { t } = useI18n();
  const contentBaseUrl = useIpfsContentBaseUrl();
  const [bodyLexicalJson, setBodyLexicalJson] = useState('');
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const body = useMemo(
    () => editorBodyToMarkdown(bodyLexicalJson, contentBaseUrl),
    [bodyLexicalJson, contentBaseUrl],
  );
  const isEdit = editTarget != null;

  const onSubmit = useCallback(async () => {
    if (!body || pending || confirming) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const op = editTarget
        ? buildCommentEditOp({
            target: editTarget,
            body,
            app: getHiveJsonMetadataDefaults().app,
          })
        : buildReplyOp(
            story,
            currentUsername,
            body,
            parentAuthor,
            parentPermlink,
          );
      const { transactionId } = await getWalletFacade().broadcast({
        operations: [op],
      });
      if (!editTarget) {
        setBodyLexicalJson('');
        setEditorKey((k) => k + 1);
      }
      setPending(false);
      setConfirming(true);
      void awaitTrxConfirmation(transactionId).finally(() => {
        void refreshAfterBroadcast(router, async () => {
          await revalidateUserFeedAfterBroadcast(
            editTarget?.author ?? story.authorName,
          );
          await revalidateHomeFeedAfterBroadcast(currentUsername);
          await onBroadcastRevalidate?.();
        }).finally(() => {
          setConfirming(false);
          if (editTarget) {
            onSaved?.();
          } else {
            onSubmitted?.();
          }
        });
      });
    } catch (err) {
      const fallback = editTarget ? t('comment_edit_failed') : 'Comment failed';
      setError(err instanceof Error && err.message ? err.message : fallback);
      setPending(false);
    }
  }, [
    body,
    confirming,
    currentUsername,
    editTarget,
    onSaved,
    onSubmitted,
    onBroadcastRevalidate,
    parentAuthor,
    parentPermlink,
    pending,
    router,
    story,
    t,
  ]);

  const canSubmit = body.length > 0 && !pending && !confirming;

  return (
    <CompactComposeEditor
      className={isEdit ? 'mt-2' : 'mt-4 border-t border-border pt-3'}
      editorKey={editorKey}
      initialBody={editTarget?.body}
      bodyPlaceholder="Write your comment…"
      onBodyChange={setBodyLexicalJson}
      hashObjectSearch={{ username: currentUsername, googlePlaces: false }}
      onSend={onSubmit}
      canSend={canSubmit}
      sendAriaLabel={isEdit ? t('comment_update_send') : 'Submit comment'}
      sendVariant="neutral"
      footer={
        <>
          {confirming ? (
            <p className="mt-2 flex items-center gap-2 text-body-sm text-fg-secondary">
              <span
                className="inline-block h-3 w-3 animate-spin rounded-circle border-2 border-current border-t-transparent"
                aria-hidden
              />
              Waiting for confirmation…
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-body-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          {isEdit ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded-btn px-2 py-0.5 text-caption text-muted hover:bg-surface-control hover:text-fg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending || confirming}
                onClick={onCancel}
              >
                {t('cancel')}
              </button>
            </div>
          ) : null}
        </>
      }
    />
  );
}
