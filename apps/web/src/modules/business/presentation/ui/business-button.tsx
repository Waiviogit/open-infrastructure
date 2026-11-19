'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import {
  businessButtonClass,
  type BusinessButtonSize,
  type BusinessButtonVariant,
} from './classes';

export type BusinessButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
> & {
  variant?: BusinessButtonVariant;
  size?: BusinessButtonSize;
  /** Shows a spinner and blocks clicks while keeping the label (no layout shift). */
  busy?: boolean;
  className?: string;
  children: ReactNode;
};

export function BusinessButton({
  variant = 'secondary',
  size = 'md',
  busy = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: BusinessButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={businessButtonClass({ variant, size, className })}
    >
      {busy ? (
        <span
          className="inline-block size-4 shrink-0 animate-spin rounded-circle border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
