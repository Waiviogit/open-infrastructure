'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { toSegments, type SegmentInput } from '../../domain/segments';
import { formatShare } from '../../domain/waiv-format';

/** Categorical slots in fixed order (theme tokens `--color-chart-1…3`). */
const SLOT_CLASSES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3'] as const;

export type BreakdownPart = SegmentInput & {
  label: string;
  /** Optional figure beside the share (e.g. "7,029,337 WAIV"). */
  detail?: string;
};

type SegmentedBreakdownProps = {
  title: string;
  parts: readonly BreakdownPart[];
};

/**
 * One whole split into ≤ 3 parts: a thin segmented bar (no text on it) above a list that gives
 * each part's name, share and figure.
 */
export function SegmentedBreakdown({ title, parts }: SegmentedBreakdownProps) {
  const { locale } = useI18n();
  const segments = toSegments(parts);
  const byId = new Map(parts.map((part, index) => [part.id, { part, slot: index }]));
  const summary = segments
    .map((segment) => `${byId.get(segment.id)?.part.label ?? segment.id} ${formatShare(segment.share, locale)}`)
    .join(', ');

  return (
    <section className="min-w-0 rounded-card border border-border bg-surface p-card-padding">
      <h3 className="text-body font-weight-strong text-fg">{title}</h3>
      <div
        role="img"
        aria-label={`${title}: ${summary}`}
        className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-pill"
      >
        {segments.map((segment) => {
          const slot = byId.get(segment.id)?.slot ?? 0;
          return (
            <span
              key={segment.id}
              className={`h-full min-w-0.5 ${SLOT_CLASSES[slot % SLOT_CLASSES.length]}`}
              style={{ flexGrow: segment.share, flexBasis: 0 }}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {parts.map((part, index) => {
          const segment = segments.find((each) => each.id === part.id);
          return (
            <li key={part.id} className="flex min-w-0 items-baseline gap-2 text-body-sm">
              <span
                aria-hidden
                className={`inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-pill ${
                  SLOT_CLASSES[index % SLOT_CLASSES.length]
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-fg">{part.label}</span>
              {part.detail ? (
                <span className="hidden text-muted tabular-nums sm:inline">{part.detail}</span>
              ) : null}
              <span className="w-12 shrink-0 text-right font-weight-strong text-fg tabular-nums">
                {formatShare(segment?.share ?? 0, locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
