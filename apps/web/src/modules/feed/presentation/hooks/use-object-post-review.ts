'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { buildOdlUpdateCreateOp, buildOdlUpdateVoteOp } from '@opden-data-layer/hive-broadcast';

import { useOdlCustomJsonId } from '@/config/odl-network-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { getWalletFacade, useHydrateWalletProvider } from '@/modules/auth';
import { awaitTrxConfirmation } from '@/modules/notifications';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import { revalidateObjectAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import {
  objectPostReviewValue,
  resolveObjectPostReviewOp,
  type ObjectPostReviewAction,
} from '../../domain/object-post-review';

/** Object Posts feed host: enables Pin / Unpin / Remove on each post card. */
export type ObjectPostReviewContext = {
  objectId: string;
  /** Drops the post from the rendered list right after a `remove` broadcast. */
  onPostRemoved: (storyId: string) => void;
};

export type ObjectPostReviewControls = {
  /** Post is shown in the pinned block (optimistic after Pin / Unpin). */
  pinned: boolean;
  viewerPinned: boolean;
  pending: boolean;
  error: string | null;
  run: (action: ObjectPostReviewAction) => Promise<void>;
};

/**
 * Pin / Unpin / Remove a post on an object's Posts feed: one `custom_json` per action
 * (`update_create`, or `update_vote` on the update the feed already returned).
 */
export function useObjectPostReview(
  story: FeedStoryView,
  context: ObjectPostReviewContext | undefined,
  currentUsername: string | null,
): ObjectPostReviewControls {
  useHydrateWalletProvider();
  const router = useRouter();
  const { t } = useI18n();
  const odlCustomJsonId = useOdlCustomJsonId();

  const serverViewerPinned = story.viewerPinned ?? false;
  const [viewerPinned, setViewerPinned] = useState(serverViewerPinned);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setViewerPinned(serverViewerPinned);
  }, [serverViewerPinned]);

  const run = useCallback(
    async (action: ObjectPostReviewAction) => {
      const account = currentUsername?.trim();
      if (!context || !account || pending) {
        return;
      }
      const op = resolveObjectPostReviewOp(action, {
        viewerPinned,
        pinUpdateId: story.pinUpdateId ?? null,
        removeUpdateId: story.removeUpdateId ?? null,
      });
      if (!op) {
        return;
      }

      setPending(true);
      setError(null);
      try {
        const customJson =
          op.kind === 'create'
            ? buildOdlUpdateCreateOp({
                id: odlCustomJsonId,
                objectId: context.objectId,
                updateType: op.updateType,
                creator: account,
                valueKind: 'text',
                value: objectPostReviewValue(story.authorName, story.permlink),
                required_posting_auths: [account],
              })
            : buildOdlUpdateVoteOp({
                id: odlCustomJsonId,
                updateId: op.updateId,
                objectId: context.objectId,
                voter: account,
                vote: op.vote,
                required_posting_auths: [account],
              });
        const { transactionId } = await getWalletFacade().broadcast({
          operations: [customJson],
        });

        if (action === 'remove') {
          context.onPostRemoved(story.id);
        } else {
          setViewerPinned(action === 'pin');
        }

        void awaitTrxConfirmation(transactionId).finally(() => {
          void refreshAfterBroadcast(router, () =>
            revalidateObjectAfterBroadcast(context.objectId),
          );
        });
      } catch {
        setError(t('object_post_review_failed'));
      } finally {
        setPending(false);
      }
    },
    [context, currentUsername, odlCustomJsonId, pending, router, story, t, viewerPinned],
  );

  const pinned = viewerPinned === serverViewerPinned ? (story.pin ?? false) : viewerPinned;

  return { pinned, viewerPinned, pending, error, run };
}
