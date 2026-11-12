'use server';

import { unstable_rethrow } from 'next/navigation';

import { fail, type Result } from '@/shared/domain/result';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

import {
  mapSinglePostToCommentEditTarget,
  type CommentEditTargetError,
} from '../../application/mappers/comment-edit-target-from-api.mapper';
import type { CommentEditTarget } from '../../domain/comment-edit-target';
import { fetchSinglePostLive } from '../clients/single-post.client';

const HTTP_NOT_FOUND = 404;

export type LoadCommentEditTargetError =
  | CommentEditTargetError
  | 'unauthorized'
  | 'service_unavailable';

/**
 * Full published body, parent and `json_metadata` of the viewer's own comment or thread,
 * read live from query-api so the inline editor starts from the latest version. Never throws.
 */
export async function loadCommentEditTargetAction(
  author: string,
  permlink: string,
): Promise<Result<CommentEditTarget, LoadCommentEditTargetError>> {
  try {
    const user = await createCookieAuthContextProvider().getUser();
    if (!user) {
      return fail('unauthorized');
    }
    const outcome = await fetchSinglePostLive(author, permlink, {
      viewer: user.username,
    });
    if (!outcome.ok) {
      return fail(
        outcome.status === HTTP_NOT_FOUND ? 'not_found' : 'service_unavailable',
      );
    }
    return mapSinglePostToCommentEditTarget(outcome.data, user.username);
  } catch (err) {
    unstable_rethrow(err);
    console.error('[loadCommentEditTargetAction] failed:', err);
    return fail('service_unavailable');
  }
}
