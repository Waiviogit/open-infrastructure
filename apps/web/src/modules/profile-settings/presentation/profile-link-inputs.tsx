'use client';

import type { HiveProfileField } from '@opden-data-layer/hive-broadcast';

import type { ProfileLinkFieldRow } from '../domain/profile-fields';

export const PROFILE_INPUT_CLASS =
  'w-full rounded-btn border border-border bg-surface px-3 py-2 text-body-sm text-fg placeholder:text-fg-muted disabled:opacity-60';

export type ProfileLinkInputsProps = {
  rows: readonly ProfileLinkFieldRow[];
  values: Readonly<Record<HiveProfileField, string>>;
  errors: Partial<Record<HiveProfileField, string>>;
  onChange: (field: HiveProfileField, value: string) => void;
  disabled?: boolean;
};

/** Brand icon + handle/address input per row (social profiles and crypto wallets). */
export function ProfileLinkInputs({
  rows,
  values,
  errors,
  onChange,
  disabled = false,
}: ProfileLinkInputsProps) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const error = errors[row.id];
        const errorId = `profile-${row.id}-error`;
        return (
          <div key={row.id}>
            <label className="relative block">
              <span className="sr-only">{row.label}</span>
              <img
                src={row.iconSrc}
                alt=""
                aria-hidden
                width={14}
                height={14}
                className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 object-contain"
              />
              <input
                type="text"
                value={values[row.id]}
                placeholder={row.label}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => onChange(row.id, event.target.value)}
                className={`${PROFILE_INPUT_CLASS} ps-8`}
              />
            </label>
            {error ? (
              <p id={errorId} role="alert" className="mt-1 text-caption text-error">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
