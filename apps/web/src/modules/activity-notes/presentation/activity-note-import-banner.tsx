'use client';

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useLoginModal } from '@/modules/auth';

import type { ActivityNote, ActivityNoteErrorCode } from '../domain/activity-note.types';
import { parseActivityNoteImportHash } from '../domain/parse-activity-note-import-hash';
import { createActivityNoteAction } from '../infrastructure/activity-notes.actions';
import { ActivityNoteBody } from './activity-note-body';
import { activityNoteErrorMessageKey } from './activity-note-error-message';

/** Drops the import hash from the address bar and keeps Next's history state (`__NA`). */
function clearImportHash(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
}

export type ActivityNoteImportBannerProps = {
  messageId: string;
  viewerUsername: string | null;
  onSaved?: (note: ActivityNote) => void;
};

/**
 * One-shot import from an agent link (`#note=…` or the legacy `#top=…&v=…`).
 * Shows the note; nothing is stored until the viewer clicks Save.
 *
 * @see docs/apps/web/spec/activity-notes.md
 */
export function ActivityNoteImportBanner({
  messageId,
  viewerUsername,
  onSaved,
}: ActivityNoteImportBannerProps) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<ActivityNoteErrorCode | null>(null);

  useEffect(() => {
    const readHash = () => {
      setMarkdown(parseActivityNoteImportHash(window.location.hash));
      setErrorCode(null);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const dismiss = useCallback(() => {
    clearImportHash();
    setMarkdown(null);
    setErrorCode(null);
  }, []);

  const save = useCallback(async () => {
    if (!markdown || pending) {
      return;
    }
    if (!viewerUsername) {
      openLogin();
      return;
    }
    setPending(true);
    setErrorCode(null);
    try {
      const result = await createActivityNoteAction(messageId, markdown);
      if (!result.ok) {
        setErrorCode(result.error.code);
        return;
      }
      onSaved?.(result.value);
      dismiss();
    } catch {
      setErrorCode('network');
    } finally {
      setPending(false);
    }
  }, [dismiss, markdown, messageId, onSaved, openLogin, pending, viewerUsername]);

  if (!markdown) {
    return null;
  }

  return (
    <section
      aria-labelledby="activity-note-import-title"
      className="flex flex-col gap-3 rounded-card border border-accent bg-accent-soft p-card-padding"
    >
      <h2 id="activity-note-import-title" className="text-body font-weight-strong text-fg">
        {t('activity_notes_import_title')}
      </h2>
      <div className="rounded-card bg-surface p-card-padding">
        <ActivityNoteBody markdown={markdown} />
      </div>
      {!viewerUsername ? (
        <p className="text-body-sm text-fg-secondary">{t('activity_notes_import_login')}</p>
      ) : null}
      {errorCode ? (
        <p role="alert" className="text-body-sm text-error">
          {t(activityNoteErrorMessageKey(errorCode))}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-btn px-4 py-2 text-body-sm text-fg hover:bg-surface-control disabled:opacity-50"
          disabled={pending}
          onClick={dismiss}
        >
          {t('activity_notes_import_dismiss')}
        </button>
        <button
          type="button"
          className="rounded-btn bg-accent px-4 py-2 text-body-sm font-weight-label text-accent-fg disabled:opacity-50"
          disabled={pending}
          onClick={() => void save()}
        >
          {t('activity_notes_import_save')}
        </button>
      </div>
    </section>
  );
}
