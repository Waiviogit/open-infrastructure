'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { historyStateWithoutSavedScroll, rememberScrollForCurrentEntry } from './scroll-memory';

/** Marks the history entry pushed for an open overlay; the value is that overlay's token. */
const OVERLAY_ENTRY_KEY = '__odlOverlay';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isOverlayEntry(state: unknown, token: string | null): boolean {
  return token !== null && isRecord(state) && state[OVERLAY_ENTRY_KEY] === token;
}

function withoutOverlayMarker(state: unknown): unknown {
  if (!isRecord(state) || !(OVERLAY_ENTRY_KEY in state)) {
    return state;
  }
  const rest = { ...state };
  delete rest[OVERLAY_ENTRY_KEY];
  return rest;
}

let tokenSeq = 0;

/**
 * Browser / phone Back closes an open overlay instead of leaving the page.
 *
 * While `open`, an extra history entry for the same URL sits on top. It copies Next's state
 * (`__NA`, so Next restores rather than reloads on Back) without the saved list scroll, and the
 * entry below is stamped with the current offset, so Back neither reloads nor jumps.
 *
 * - Back pops that entry: the overlay closes, the URL stays.
 * - Closed another way (backdrop, Escape): the entry is popped with `history.back()`.
 * - Links inside the overlay must navigate with `replace`: the new URL takes the entry's place,
 *   so history matches plain push navigation. When the overlay stays open across that
 *   navigation, a fresh entry is pushed once the new pathname commits.
 */
export function useCloseOnHistoryBack(open: boolean, onClose: () => void, enabled = true): void {
  const pathname = usePathname();
  const active = enabled && open;
  const tokenRef = useRef<string | null>(null);
  const hrefRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (tokenRef.current === null) {
      tokenSeq += 1;
      tokenRef.current = `overlay-${tokenSeq}`;
    }
    const token = tokenRef.current;
    if (isOverlayEntry(window.history.state, token) && window.location.href === hrefRef.current) {
      return;
    }
    // A navigation inside the overlay replaced our entry: that entry is now a page; keep it clean.
    window.history.replaceState(withoutOverlayMarker(window.history.state), '');
    rememberScrollForCurrentEntry();
    window.history.pushState(
      { ...(historyStateWithoutSavedScroll(window.history.state) as object), [OVERLAY_ENTRY_KEY]: token },
      '',
      window.location.href,
    );
    hrefRef.current = window.location.href;
  }, [active, pathname]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const onPopState = () => {
      if (!isOverlayEntry(window.history.state, tokenRef.current)) {
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  useEffect(() => {
    if (active) {
      return;
    }
    const token = tokenRef.current;
    tokenRef.current = null;
    if (isOverlayEntry(window.history.state, token) && window.location.href === hrefRef.current) {
      window.history.back();
    }
  }, [active]);
}
