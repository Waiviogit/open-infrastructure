'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useId, useRef, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { insertMediaUrlAtSelection } from '../../application/insert-editor-media-url';

export type EditorInlineVideoInputProps = {
  /** Restores the caret saved when the input opened (focus moved to this field). */
  restoreSelection: () => void;
  onInserted: () => void;
};

/**
 * Legacy-style video insert at the caret line: "Paste video link and press Enter".
 * A supported link becomes an embedded player block; anything else shows an error.
 */
export function EditorInlineVideoInput({ restoreSelection, onInserted }: EditorInlineVideoInputProps) {
  const [editor] = useLexicalComposerContext();
  const { t } = useI18n();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(): void {
    restoreSelection();
    if (!insertMediaUrlAtSelection(editor, url.trim())) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    editor.focus();
    onInserted();
  }

  return (
    <form
      className="relative min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {t('editor_video_link_placeholder')}
      </label>
      {/* One bordered control: the frame belongs to the wrapper, input and button sit flush inside. */}
      <div
        className={[
          'flex h-10 items-stretch overflow-hidden rounded-btn border bg-bg',
          invalid ? 'border-error' : 'border-accent',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={url}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => {
            setUrl(e.target.value);
            setInvalid(false);
          }}
          placeholder={t('editor_video_link_placeholder')}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-body text-fg shadow-none outline-none ring-0 placeholder:text-fg-tertiary focus:outline-none focus:ring-0 focus-visible:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 bg-accent px-4 text-body-sm font-weight-label text-accent-fg hover:bg-accent-hover focus-visible:bg-accent-hover focus-visible:outline-none"
        >
          {t('editor_video_link_submit')}
        </button>
      </div>
      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="absolute start-0 top-full mt-1 rounded-btn bg-surface px-2 py-1 text-caption text-error shadow-card"
        >
          {t('editor_insert_video_invalid')}
        </p>
      ) : null}
    </form>
  );
}
