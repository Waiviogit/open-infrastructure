'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import {
  editorBodyToMarkdown,
  hasLexicalDraftBodyContent,
  isLexicalDraftJson,
} from '@/modules/editor';

import {
  decideHostBodyDraftSave,
  hashHostBodySource,
  type HostBodyDraft,
  type HostBodyDraftKey,
  type HostBodyDraftRepository,
} from '../../domain/host-body-draft';
import type { HostBodyTabDefinition } from '../../domain/host-body-tab';
import { getHostBodyDraftRepository } from '../../infrastructure/host-body-draft/host-body-draft-repository';

/** Idle time after the last edit before the draft is written. */
export const HOST_BODY_DRAFT_AUTOSAVE_MS = 1000;

/** The editor waits at most this long for the stored draft before it opens. */
export const HOST_BODY_DRAFT_LOAD_TIMEOUT_MS = 500;

export type HostBodyDraftStatus = 'loading' | 'ready';

export type UseHostBodyDraftInput = {
  username: string;
  objectId: string;
  tab: HostBodyTabDefinition;
  /** The published body shown on the tab now. */
  currentSource: string;
  /** Drafts store; defaults to the app's (IndexedDB). */
  repository?: HostBodyDraftRepository;
};

export type UseHostBodyDraftResult = {
  status: HostBodyDraftStatus;
  /** A stored draft waiting for Continue / Discard. */
  pendingDraft: HostBodyDraft | null;
  /** The published body changed since the pending draft was saved. */
  isStale: boolean;
  /** Every editor emission (Lexical JSON). */
  onBodyChange: (bodyJson: string) => void;
  /** Real user input on the editor: only after it are emissions saved. */
  markUserInput: () => void;
  /** Takes the pending draft; returns its body for the editor. */
  continueDraft: () => string | null;
  /** Deletes the pending draft; the editor keeps what it shows. */
  discardDraft: () => void;
  /** A body update was published: the draft is done. */
  onPublished: (publishedBody: string) => void;
};

function isUsableDraft(draft: HostBodyDraft | null, updateType: string): draft is HostBodyDraft {
  return (
    draft != null &&
    draft.updateType === updateType &&
    isLexicalDraftJson(draft.body) &&
    hasLexicalDraftBodyContent(draft.body)
  );
}

/**
 * One local draft per user and object for the host body editor (HTML, Page, Document).
 *
 * Loading a body into the editor emits it (and the markdown round trip may reformat it), so
 * emissions are saved only after real user input. While a stored draft waits for Continue /
 * Discard nothing is saved, so typing cannot overwrite it.
 */
export function useHostBodyDraft({
  username,
  objectId,
  tab,
  currentSource,
  repository,
}: UseHostBodyDraftInput): UseHostBodyDraftResult {
  const contentBaseUrl = useIpfsContentBaseUrl();
  const key = useMemo<HostBodyDraftKey>(() => ({ username, objectId }), [username, objectId]);

  const [status, setStatus] = useState<HostBodyDraftStatus>('loading');
  const [pendingDraft, setPendingDraft] = useState<HostBodyDraft | null>(null);

  const repositoryRef = useRef<HostBodyDraftRepository | null>(repository ?? null);
  const latestJsonRef = useRef<string | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  const armedRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSourceRef = useRef(currentSource);
  const sessionPublishedRef = useRef<string[]>([]);

  const store = useCallback((): HostBodyDraftRepository => {
    if (!repositoryRef.current) {
      repositoryRef.current = getHostBodyDraftRepository();
    }
    return repositoryRef.current;
  }, []);

  useEffect(() => {
    currentSourceRef.current = currentSource;
  }, [currentSource]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async () => {
    clearTimer();
    const json = latestJsonRef.current;
    if (!armedRef.current || pendingRef.current || json == null || json === lastPersistedRef.current) {
      return;
    }
    const decision = decideHostBodyDraftSave({
      format: tab.format,
      markdown: editorBodyToMarkdown(json, contentBaseUrl),
      publishedSources: [currentSourceRef.current, ...sessionPublishedRef.current],
    });
    if (decision === 'save') {
      const saved = await store().save({
        ...key,
        updateType: tab.updateType,
        body: json,
        baseSourceHash: hashHostBodySource(currentSourceRef.current),
        updatedAt: Date.now(),
      });
      if (saved) {
        lastPersistedRef.current = json;
      }
      return;
    }
    if (lastPersistedRef.current !== null) {
      lastPersistedRef.current = null;
      await store().remove(key);
    }
  }, [clearTimer, contentBaseUrl, key, store, tab.format, tab.updateType]);

  const runSaveRef = useRef(runSave);
  useEffect(() => {
    runSaveRef.current = runSave;
  }, [runSave]);

  const scheduleSave = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      void runSaveRef.current();
    }, HOST_BODY_DRAFT_AUTOSAVE_MS);
  }, [clearTimer]);

  useEffect(() => {
    let cancelled = false;
    armedRef.current = false;
    pendingRef.current = false;
    lastPersistedRef.current = null;
    setPendingDraft(null);
    setStatus('loading');

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus('ready');
      }
    }, HOST_BODY_DRAFT_LOAD_TIMEOUT_MS);

    void store()
      .load(key)
      .then((draft) => {
        if (cancelled) {
          return;
        }
        if (isUsableDraft(draft, tab.updateType)) {
          pendingRef.current = true;
          setPendingDraft(draft);
        }
        setStatus('ready');
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [key, store, tab.updateType]);

  useEffect(() => {
    const flush = () => {
      if (timerRef.current) {
        void runSaveRef.current();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, []);

  const onBodyChange = useCallback(
    (bodyJson: string) => {
      latestJsonRef.current = bodyJson;
      if (armedRef.current && !pendingRef.current) {
        scheduleSave();
      }
    },
    [scheduleSave],
  );

  const markUserInput = useCallback(() => {
    armedRef.current = true;
  }, []);

  const continueDraft = useCallback((): string | null => {
    const draft = pendingDraft;
    if (!draft) {
      return null;
    }
    clearTimer();
    pendingRef.current = false;
    // The editor remounts with the draft and emits it: that is not a new edit.
    armedRef.current = false;
    lastPersistedRef.current = draft.body;
    latestJsonRef.current = draft.body;
    setPendingDraft(null);
    return draft.body;
  }, [clearTimer, pendingDraft]);

  const discardDraft = useCallback(() => {
    pendingRef.current = false;
    lastPersistedRef.current = null;
    setPendingDraft(null);
    void store().remove(key);
    if (armedRef.current && latestJsonRef.current != null) {
      scheduleSave();
    }
  }, [key, scheduleSave, store]);

  const onPublished = useCallback(
    (publishedBody: string) => {
      clearTimer();
      sessionPublishedRef.current = [...sessionPublishedRef.current, publishedBody];
      armedRef.current = false;
      if (pendingRef.current) {
        return;
      }
      lastPersistedRef.current = null;
      void store().remove(key);
    },
    [clearTimer, key, store],
  );

  const isStale =
    pendingDraft != null && pendingDraft.baseSourceHash !== hashHostBodySource(currentSource);

  return {
    status,
    pendingDraft,
    isStale,
    onBodyChange,
    markUserInput,
    continueDraft,
    discardDraft,
    onPublished,
  };
}
