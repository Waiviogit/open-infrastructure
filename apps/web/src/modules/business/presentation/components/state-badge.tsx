'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

export type StateBadgeVariant =
  | 'active'
  | 'confirmed'
  | 'pending'
  | 'pending_signature'
  | 'disputed'
  | 'resolved'
  | 'retired'
  | 'cancelled'
  | 'indexing';

type StateTone = 'success' | 'progress' | 'danger' | 'neutral';

const LABEL_KEYS: Record<StateBadgeVariant, string> = {
  active: 'business_state_active',
  confirmed: 'business_state_confirmed',
  pending: 'business_state_pending',
  pending_signature: 'business_state_pending_signature',
  disputed: 'business_state_disputed',
  resolved: 'business_state_resolved',
  retired: 'business_state_retired',
  cancelled: 'business_state_cancelled',
  indexing: 'business_state_indexing',
};

const TONES: Record<StateBadgeVariant, StateTone> = {
  active: 'success',
  confirmed: 'success',
  resolved: 'success',
  pending: 'progress',
  pending_signature: 'progress',
  indexing: 'progress',
  disputed: 'danger',
  retired: 'neutral',
  cancelled: 'neutral',
};

/** A quiet neutral pill; the coloured dot carries the meaning (never colour alone: the label stays). */
const DOT_CLASS: Record<StateTone, string> = {
  success: 'bg-success',
  progress: 'bg-accent',
  danger: 'bg-error',
  neutral: 'bg-fg-tertiary',
};

export function StateBadge({ variant }: { variant: StateBadgeVariant }) {
  const { t } = useI18n();
  const tone = TONES[variant];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border border-border bg-surface px-2 py-0.5 text-caption text-fg">
      <span
        className={`size-1.5 shrink-0 rounded-circle ${DOT_CLASS[tone]} ${variant === 'indexing' ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      {t(LABEL_KEYS[variant])}
    </span>
  );
}
