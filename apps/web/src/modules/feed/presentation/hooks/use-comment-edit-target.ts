'use client';

import { useCallback, useRef, useState } from 'react';

import type { CommentEditTarget } from '../../domain/comment-edit-target';
import { loadCommentEditTargetAction } from '../../infrastructure/actions/load-comment-edit-target.action';

export type CommentEditState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; target: CommentEditTarget }
  | { status: 'error' };

/**
 * Inline edit of the viewer's own comment or thread. `open` loads the full published body on
 * click (feed cards carry only an excerpt); `close` drops it.
 */
export function useCommentEditTarget(author: string, permlink: string) {
  const [state, setState] = useState<CommentEditState>({ status: 'idle' });
  const requestId = useRef(0);

  const open = useCallback(async () => {
    const id = ++requestId.current;
    setState({ status: 'loading' });
    try {
      const result = await loadCommentEditTargetAction(author, permlink);
      if (id !== requestId.current) {
        return;
      }
      setState(
        result.ok
          ? { status: 'ready', target: result.value }
          : { status: 'error' },
      );
    } catch {
      if (id === requestId.current) {
        setState({ status: 'error' });
      }
    }
  }, [author, permlink]);

  const close = useCallback(() => {
    requestId.current += 1;
    setState({ status: 'idle' });
  }, []);

  return { state, open, close };
}
