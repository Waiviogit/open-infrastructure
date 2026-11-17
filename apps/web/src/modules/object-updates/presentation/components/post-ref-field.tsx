'use client';

import { useId } from 'react';

import { postRefFromInput } from '@opden-data-layer/core/update-registry';

import { useI18n } from '@/i18n/providers/i18n-provider';

export type PostRefFieldProps = {
  label?: string;
  value: unknown;
  onChange: (value: string) => void;
};

/** `pin` / `remove` value: a post link or `author/permlink`, normalized on submit. */
export function PostRefField({ label, value, onChange }: PostRefFieldProps) {
  const { t } = useI18n();
  const hintId = useId();
  const text = typeof value === 'string' ? value : '';
  const invalid = text.trim() !== '' && postRefFromInput(text) == null;

  return (
    <label className="block text-body-sm">
      {label ? <span className="font-weight-label text-fg">{label}</span> : null}
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        className="mt-2 w-full rounded-btn border border-border bg-bg px-3 py-2 text-body-sm text-fg placeholder:text-muted"
        value={text}
        placeholder="https://…/@author/permlink"
        aria-invalid={invalid}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={hintId} className="mt-1 block text-caption text-muted">
        {t('object_post_ref_hint')}
      </span>
      {invalid ? (
        <span className="mt-1 block text-caption text-error" role="alert">
          {t('object_post_ref_invalid')}
        </span>
      ) : null}
    </label>
  );
}
