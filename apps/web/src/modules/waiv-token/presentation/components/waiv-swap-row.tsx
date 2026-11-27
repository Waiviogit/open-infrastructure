'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { formatWalletHistoryQuantity, WalletDualAmount } from '@/modules/user-wallet/history-ui';
import { UserAvatar } from '@/shared/presentation';

import { swapRate, swapSide } from '../../domain/swap-view';
import type { WaivSwap } from '../../domain/waiv-token.types';

const AVATAR_SIZE = 36;

/** "5 min ago" depends on the clock: filled after mount so SSR and hydration agree. */
function SwapTime({ timestamp }: { timestamp: string }) {
  const { locale } = useI18n();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const seconds = Math.round((Date.parse(timestamp) - Date.now()) / 1000);
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['second', 60],
      ['minute', 60],
      ['hour', 24],
      ['day', 30],
      ['month', 12],
      ['year', Number.POSITIVE_INFINITY],
    ];
    let value = seconds;
    for (const [unit, size] of steps) {
      if (Math.abs(value) < size) {
        setLabel(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(value), unit));
        return;
      }
      value /= size;
    }
  }, [locale, timestamp]);

  return (
    <time dateTime={timestamp} className="text-caption text-muted" suppressHydrationWarning>
      {label ?? ' '}
    </time>
  );
}

/** Left: who and when. Right: the wallet history swap block (paid / received, then the rate). */
export function WaivSwapRow({ swap }: { swap: WaivSwap }) {
  const { t } = useI18n();
  const side = swapSide(swap);
  const rate = swapRate(swap);
  const profileHref = `/@${encodeURIComponent(swap.account)}`;

  return (
    <li className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0">
      <Link href={profileHref} className="shrink-0" suppressHydrationWarning tabIndex={-1} aria-hidden>
        <UserAvatar username={swap.account} avatarUrl={swap.avatarUrl} size={AVATAR_SIZE} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={profileHref}
            className="truncate text-body font-weight-strong text-fg hover:text-link"
            suppressHydrationWarning
          >
            @{swap.account}
          </Link>
          <span
            className={`shrink-0 rounded-pill bg-surface-control px-2 text-caption font-weight-strong ${
              side === 'buy' ? 'text-success' : 'text-error'
            }`}
          >
            {t(side === 'buy' ? 'waiv_page_swap_buy' : 'waiv_page_swap_sell')}
          </span>
        </div>
        <SwapTime timestamp={swap.timestamp} />
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="text-body-sm font-weight-label whitespace-nowrap">
          <WalletDualAmount
            transfer={`${formatWalletHistoryQuantity(swap.symbolInQuantity)} ${swap.symbolIn}`}
            received={`${formatWalletHistoryQuantity(swap.symbolOutQuantity)} ${swap.symbolOut}`}
          />
        </span>
        {rate ? (
          <span className="text-caption text-muted">
            {t('waiv_page_swap_price', {
              price: formatWalletHistoryQuantity(rate.rate),
              quote: rate.quote,
              base: rate.base,
            })}
          </span>
        ) : null}
      </div>
    </li>
  );
}
