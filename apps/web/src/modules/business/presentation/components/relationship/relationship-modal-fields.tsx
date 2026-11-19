'use client';

import {
  isOblUsdAmount,
  parseOblUsdAmount,
} from '@opden-data-layer/core/utils/obl-usd-amount';

import { ArrowUpDownIcon } from '@/icons';

import { BUSINESS_BREAK_TEXT, BUSINESS_FOCUS_RING } from '../../ui/classes';

export function RelationshipReadonlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 text-body-sm">
      <p className="text-caption text-fg-secondary">{label}</p>
      <p className="mt-0.5 break-words text-body-sm tabular-nums text-fg [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

export function AccountPairSwapButton({
  ariaLabel,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-9 shrink-0 items-center justify-center rounded-btn text-fg-secondary transition-colors hover:bg-surface-alt hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 max-lg:size-11 ${BUSINESS_FOCUS_RING}`}
    >
      <ArrowUpDownIcon size={18} className="rotate-90" />
    </button>
  );
}

export function AccountPairSwapRow({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  swapAriaLabel,
  disabled,
  onSwap,
}: {
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  swapAriaLabel: string;
  disabled: boolean;
  onSwap: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2">
        <span className="text-caption text-fg-secondary">{leftLabel}</span>
        <span aria-hidden className="w-9 shrink-0 max-lg:w-11" />
        <span className="text-caption text-fg-secondary">{rightLabel}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2">
        <span
          className={`min-w-0 text-body-sm font-weight-label text-fg ${BUSINESS_BREAK_TEXT}`}
        >
          {leftValue}
        </span>
        <AccountPairSwapButton
          ariaLabel={swapAriaLabel}
          disabled={disabled}
          onClick={onSwap}
        />
        <span
          className={`min-w-0 text-body-sm font-weight-label text-fg ${BUSINESS_BREAK_TEXT}`}
        >
          {rightValue}
        </span>
      </div>
    </div>
  );
}

export function parsePositiveUsdAmount(raw: string): boolean {
  return isOblUsdAmount(raw, 'positive');
}

export function parseNonNegativeUsdAmount(raw: string): boolean {
  return isOblUsdAmount(raw, 'nonnegative');
}

export function normalizePositiveUsdAmount(raw: string): string | null {
  return parseOblUsdAmount(raw, 'positive');
}

export function normalizeNonNegativeUsdAmount(raw: string): string | null {
  return parseOblUsdAmount(raw, 'nonnegative');
}
