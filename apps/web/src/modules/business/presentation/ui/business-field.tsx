'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';

type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export type BusinessFieldProps = {
  label: ReactNode;
  /** A single input / select / textarea; receives `id`, `aria-describedby`, `aria-invalid`. */
  children: ReactElement<FieldControlProps>;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
};

/** Label + control + hint + field error, wired for screen readers. */
export function BusinessField({
  label,
  children,
  hint,
  error,
  required = false,
  className = '',
}: BusinessFieldProps) {
  const baseId = useId();
  const controlId = children.props.id ?? `${baseId}-control`;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label
        htmlFor={controlId}
        className="text-body-sm font-weight-label text-fg"
      >
        {label}
        {required ? (
          <span className="text-error" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-caption text-fg-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
