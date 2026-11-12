'use client';

import { useCallback, useMemo, useState } from 'react';

import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { CompactComposeEditor, editorBodyToMarkdown } from '@/modules/editor';

import { ACTIVITY_NOTE_BODY_MAX_CHARS } from '../domain/activity-notes.constants';

export type ActivityNoteComposerProps = {
  /** Signed-in note author (`#` object search). */
  viewerUsername: string;
  /** Markdown seed when editing an existing note. */
  initialBody?: string;
  pending?: boolean;
  submitLabel: string;
  /** Resolves `true` when the note was saved (the composer then clears itself). */
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
};

/** Note editor: the same compose editor as every other surface, markdown out. */
export function ActivityNoteComposer({
  viewerUsername,
  initialBody,
  pending = false,
  submitLabel,
  onSubmit,
  onCancel,
}: ActivityNoteComposerProps) {
  const { t } = useI18n();
  const contentBaseUrl = useIpfsContentBaseUrl();
  const [bodyLexicalJson, setBodyLexicalJson] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const markdown = useMemo(
    () => editorBodyToMarkdown(bodyLexicalJson, contentBaseUrl),
    [bodyLexicalJson, contentBaseUrl],
  );
  const tooLong = markdown.length > ACTIVITY_NOTE_BODY_MAX_CHARS;
  const canSend = markdown.length > 0 && !tooLong && !pending;

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }
    const saved = await onSubmit(markdown);
    if (saved) {
      setBodyLexicalJson('');
      setEditorKey((key) => key + 1);
    }
  }, [canSend, markdown, onSubmit]);

  return (
    <div className="flex flex-col gap-2">
      <CompactComposeEditor
        editorKey={editorKey}
        initialBody={initialBody}
        bodyPlaceholder={t('activity_notes_placeholder')}
        onBodyChange={setBodyLexicalJson}
        onSend={handleSend}
        canSend={canSend}
        sendAriaLabel={submitLabel}
        sendVariant="accent"
        hashObjectSearch={{ username: viewerUsername, googlePlaces: false }}
        insertPanelPreferBelow
      />
      {tooLong ? (
        <p role="alert" className="text-caption text-error">
          {t('activity_notes_too_long').replace('{max}', String(ACTIVITY_NOTE_BODY_MAX_CHARS))}
        </p>
      ) : null}
      {onCancel ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-btn px-3 py-1 text-body-sm text-fg-secondary hover:bg-surface-control hover:text-fg disabled:opacity-50"
            disabled={pending}
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
