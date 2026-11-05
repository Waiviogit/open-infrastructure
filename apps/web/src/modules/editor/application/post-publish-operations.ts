import {
  buildCommentOp,
  buildVoteOp,
  type CommentOp,
  type CommentOptionsOp,
  type VoteOp,
} from '@opden-data-layer/hive-broadcast';

import type {
  PostEditorBeneficiary,
  PostEditorRewardMode,
} from '../domain/post-editor-advanced-settings';
import { buildPublishCommentOptions } from './post-editor-advanced-settings';

/** Full upvote weight (Hive basis points). */
export const SELF_UPVOTE_WEIGHT = 10000;

type PostContent = {
  author: string;
  permlink: string;
  parentPermlink: string;
  title: string;
  body: string;
  jsonMetadata: string;
};

export type PostPublishOperationsInput =
  | (PostContent & {
      mode: 'create';
      rewardMode: PostEditorRewardMode;
      beneficiaries: readonly PostEditorBeneficiary[];
      selfUpvote: boolean;
    })
  /** Payout options and beneficiaries cannot change after publish; votes are separate. */
  | (PostContent & { mode: 'edit' });

/**
 * Operations for one post broadcast. New post: `comment`, `comment_options`,
 * optional author self-`vote`. Edit: only `comment` with the original permlink.
 */
export function buildPostPublishOperations(
  input: PostPublishOperationsInput,
): (CommentOp | CommentOptionsOp | VoteOp)[] {
  const comment = buildCommentOp({
    parent_author: '',
    parent_permlink: input.parentPermlink,
    author: input.author,
    permlink: input.permlink,
    title: input.title,
    body: input.body,
    json_metadata: input.jsonMetadata,
  });
  if (input.mode === 'edit') {
    return [comment];
  }
  const operations: (CommentOp | CommentOptionsOp | VoteOp)[] = [
    comment,
    buildPublishCommentOptions({
      author: input.author,
      permlink: input.permlink,
      rewardMode: input.rewardMode,
      beneficiaries: input.beneficiaries,
    }),
  ];
  if (input.selfUpvote) {
    operations.push(buildVoteOp(input.author, input.author, input.permlink, SELF_UPVOTE_WEIGHT));
  }
  return operations;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/** Parses Hive `json_metadata` (string or object) into a plain record; invalid → `{}`. */
export function parseHiveJsonMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') {
    return asRecord(raw);
  }
  try {
    return asRecord(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

type LegacyWobject = { author_permlink?: unknown; percent?: unknown };

/**
 * Editor seed from a published post's `json_metadata`: all keys kept; legacy
 * `wobj.wobjects` become `objects` (and `wobj` is dropped so a stale copy is
 * not re-published) when the post has no `objects` yet.
 */
export function editorJsonMetadataFromPublishedPost(raw: unknown): Record<string, unknown> {
  const meta = parseHiveJsonMetadata(raw);
  if (Array.isArray(meta.objects)) {
    return meta;
  }
  const wobjects = asRecord(meta.wobj).wobjects;
  if (!Array.isArray(wobjects)) {
    return meta;
  }
  const objects = (wobjects as LegacyWobject[])
    .filter((w) => typeof w.author_permlink === 'string' && w.author_permlink.length > 0)
    .map((w) => ({
      object_id: w.author_permlink as string,
      percent: typeof w.percent === 'number' ? w.percent : 0,
    }));
  if (objects.length === 0) {
    return meta;
  }
  const rest = { ...meta };
  delete rest.wobj;
  return { ...rest, objects };
}

/**
 * `json_metadata` for an edit: the published post's keys stay; the editor's own
 * keys (objects, tags, images, app, …) replace theirs.
 */
export function mergeEditedPostJsonMetadata(
  published: unknown,
  editorOwned: Record<string, unknown>,
): Record<string, unknown> {
  return { ...parseHiveJsonMetadata(published), ...editorOwned };
}
