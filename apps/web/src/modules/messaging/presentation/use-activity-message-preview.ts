'use client';

import { useCallback, useEffect, useState } from 'react';

import { pushInstantUrl } from '@/shared/presentation/navigation';

import type { MessageItem } from '../domain/messaging.types';

export type ActivityMessagePreviewState = {
  message: MessageItem;
  href: string;
};

/**
 * Preview modal over an activity feed, like the post modal: opening pushes the message permalink
 * (its own history entry), closing goes back. Back/Forward close it via `popstate`.
 * Refresh or a direct visit renders the full permalink page instead (proxy rewrite).
 */
export function useActivityMessagePreview() {
  const [preview, setPreview] = useState<ActivityMessagePreviewState | null>(null);

  const open = useCallback((message: MessageItem, href: string) => {
    pushInstantUrl(href);
    setPreview({ message, href });
  }, []);

  const close = useCallback(() => {
    window.history.back();
  }, []);

  useEffect(() => {
    if (!preview) {
      return undefined;
    }
    const onPopState = () => {
      if (window.location.pathname !== preview.href) {
        setPreview(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [preview]);

  return { preview, open, close };
}
