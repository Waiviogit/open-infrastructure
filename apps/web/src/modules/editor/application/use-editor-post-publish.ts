'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { imageContentUrlForCid } from '@/config/ipfs-content-url';
import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { getHiveJsonMetadataDefaults } from '@/config/hive-json-metadata-public';
import { getWalletFacade, useHydrateWalletProvider } from '@/modules/auth';
import { awaitTrxConfirmation } from '@/modules/notifications';
import { buildHiveJsonMetadata, createUniqueRootPostPermlink } from '@/shared';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import {
  revalidateHomeFeedAfterBroadcast,
  revalidateUserFeedAfterBroadcast,
} from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import type { PostEditorLinkedObject } from '../domain/post-editor-linked-object';
import {
  collectImageCidsFromEditorState,
  hasLexicalDraftBodyContent,
} from './editor-body-serialization';
import { buildHivePostImageMetadata } from './build-hive-post-image-metadata';
import { lexicalStateToMarkdown } from './lexical-state-to-markdown';
import { buildPostPublishOperations, mergeEditedPostJsonMetadata } from './post-publish-operations';
import {
  buildPublishTags,
  stripEditorOnlyJsonMetadataFields,
  validateBeneficiaries,
} from './post-editor-advanced-settings';
import type { PostEditorBeneficiary } from '../domain/post-editor-advanced-settings';
import type { PostEditorRewardMode } from '../domain/post-editor-advanced-settings';
import type { PostEditTarget } from '../domain/post-edit-target';
import {
  mergeJsonMetadataWithObjects,
  validateLinkedObjectPercents,
} from './post-editor-objects-metadata';
import { checkPostExistsAction } from '../infrastructure/check-post-exists.action';
import { deleteUserDraftAction } from '../infrastructure/drafts.actions';

export type EditorPublishPhase = 'idle' | 'publishing' | 'confirming';

export type UseEditorPostPublishInput = {
  username: string;
  title: string;
  body: string;
  jsonMetadata: unknown;
  linkedObjects: readonly PostEditorLinkedObject[];
  tags: readonly string[];
  rewardMode: PostEditorRewardMode;
  beneficiaries: readonly PostEditorBeneficiary[];
  draftId: string | null;
  legalAccepted: boolean;
  flushSave: () => Promise<void>;
  /** "Like this post": author upvotes the new post in the same transaction. */
  selfUpvote: boolean;
  /** Set when editing a published post: same permlink, `comment` only. */
  editTarget: PostEditTarget | null;
};

export function useEditorPostPublish({
  username,
  title,
  body,
  jsonMetadata,
  linkedObjects,
  tags,
  rewardMode,
  beneficiaries,
  draftId,
  legalAccepted,
  flushSave,
  selfUpvote,
  editTarget,
}: UseEditorPostPublishInput) {
  useHydrateWalletProvider();
  const router = useRouter();
  const contentBaseUrl = useIpfsContentBaseUrl();
  const [phase, setPhase] = useState<EditorPublishPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const canPublishContent =
    legalAccepted &&
    validateLinkedObjectPercents(linkedObjects).ok &&
    validateBeneficiaries(beneficiaries, username).ok &&
    title.trim().length > 0 &&
    hasLexicalDraftBodyContent(body);

  const publish = useCallback(async () => {
    if (!canPublishContent || phase !== 'idle') {
      return;
    }
    setError(null);
    setPhase('publishing');
    try {
      await flushSave();

      const resolveImageUrl = (cid: string, src: string) => {
        if (cid && contentBaseUrl) {
          return imageContentUrlForCid(contentBaseUrl, cid);
        }
        return src.trim();
      };
      const markdown = lexicalStateToMarkdown(body, { resolveImageUrl });
      if (!title.trim() || !hasLexicalDraftBodyContent(body)) {
        throw new Error('empty_post');
      }

      const permlink =
        editTarget?.permlink ??
        (await createUniqueRootPostPermlink(
          { title, author: username },
          { exists: checkPostExistsAction },
        ));

      const defaults = getHiveJsonMetadataDefaults();
      const host =
        typeof window !== 'undefined' ? window.location.host : 'localhost';
      const publishTags = buildPublishTags(tags, defaults.community);
      const baseMeta = buildHiveJsonMetadata({
        host,
        community: defaults.community,
        app: defaults.app,
        tags: publishTags,
      });
      const imageCids = collectImageCidsFromEditorState(body);
      const imageUrls = buildHivePostImageMetadata(
        imageCids,
        contentBaseUrl,
        (cid) => imageContentUrlForCid(contentBaseUrl!, cid),
      );
      const merged = stripEditorOnlyJsonMetadataFields(
        mergeJsonMetadataWithObjects(jsonMetadata, linkedObjects) as Record<
          string,
          unknown
        >,
      );
      const editorOwned = {
        ...baseMeta,
        tags: publishTags,
        ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
      };
      const json_metadata = JSON.stringify(
        editTarget
          ? mergeEditedPostJsonMetadata(merged, editorOwned)
          : { ...baseMeta, ...merged, ...editorOwned },
      );

      const content = {
        author: username,
        permlink,
        title: title.trim(),
        body: markdown,
        jsonMetadata: json_metadata,
      };
      const operations = editTarget
        ? buildPostPublishOperations({
            ...content,
            mode: 'edit',
            parentPermlink: editTarget.parentPermlink,
          })
        : buildPostPublishOperations({
            ...content,
            mode: 'create',
            parentPermlink: defaults.community,
            rewardMode,
            beneficiaries,
            selfUpvote,
          });

      const { transactionId } = await getWalletFacade().broadcast({ operations });

      setPhase('confirming');
      await awaitTrxConfirmation(transactionId);

      if (draftId) {
        await deleteUserDraftAction(username, { draftId });
      }

      await refreshAfterBroadcast(router, async () => {
        await revalidateUserFeedAfterBroadcast(username);
        await revalidateHomeFeedAfterBroadcast(username);
      });

      router.push(
        editTarget
          ? `/@${encodeURIComponent(username)}/${encodeURIComponent(permlink)}`
          : `/@${encodeURIComponent(username)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'publish_failed');
      setPhase('idle');
    }
  }, [
    body,
    canPublishContent,
    contentBaseUrl,
    draftId,
    flushSave,
    jsonMetadata,
    linkedObjects,
    beneficiaries,
    editTarget,
    phase,
    rewardMode,
    router,
    selfUpvote,
    tags,
    title,
    username,
  ]);

  return {
    publish,
    phase,
    error,
    setError,
    canPublish: canPublishContent,
    busy: phase !== 'idle',
  };
}
