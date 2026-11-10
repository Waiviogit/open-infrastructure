'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';

import { TrashIcon } from '@/icons';

type EditorImageFieldFormProps = {
  initialValue: string;
  placeholder: string;
  inputLabel: string;
  applyLabel: string;
  /** Shown only when the image already has a value. */
  removeLabel: string;
  inputType: 'url' | 'text';
  maxLength?: number;
  /** Returns an error message to keep the form open, or null when the value was applied. */
  onApply: (value: string) => string | null;
  onRemove: () => void;
  onCancel: () => void;
};

const BUTTON_CLASS =
  'flex h-8 shrink-0 items-center rounded-btn px-2 text-body-sm font-weight-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Inline field in the block toolbar for an image's link or alt text (Enter applies, Escape cancels). */
export function EditorImageFieldForm({
  initialValue,
  placeholder,
  inputLabel,
  applyLabel,
  removeLabel,
  inputType,
  maxLength,
  onApply,
  onRemove,
  onCancel,
}: EditorImageFieldFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    input.select();
  }, []);

  const apply = () => setError(onApply(value));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          maxLength={maxLength}
          aria-label={inputLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          className={[
            'h-8 min-w-[12rem] max-w-[20rem] rounded-btn border bg-bg px-2 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring',
            error ? 'border-error' : 'border-border',
          ].join(' ')}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button
          type="button"
          className={`${BUTTON_CLASS} bg-accent px-3 text-accent-fg hover:opacity-90`}
          onClick={apply}
        >
          {applyLabel}
        </button>
        {initialValue ? (
          <button
            type="button"
            className={`${BUTTON_CLASS} text-fg hover:bg-ghost-surface`}
            aria-label={removeLabel}
            title={removeLabel}
            onClick={onRemove}
          >
            <TrashIcon size={16} />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="px-1 text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
