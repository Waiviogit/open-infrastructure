import type { LocaleId, Translate } from '@/i18n/types';
export { formatRelativeFeedTime } from '@/shared/utils/format-relative-time';

/** Match query-api `FEED_TAGGED_OBJECT_DISPLAY_LIMIT` (feed.constants.ts). */
export const FEED_STORY_TAGGED_OBJECT_MAX = 4;

/** Like summary for a story ("@alice and @bob liked this"); a plain count when names are missing. */
export function formatVoteSummary(
  totalCount: number,
  previewVoters: readonly string[],
  t: Translate,
): string | null {
  if (totalCount <= 0) {
    return null;
  }
  const [first, second] = previewVoters;
  if (totalCount === 1 && first) {
    return t('feed_story_vote_summary_single', { first });
  }
  if (totalCount > 1 && first && second) {
    return totalCount === 2
      ? t('feed_story_vote_summary_pair', { first, second })
      : t('feed_story_vote_summary_more', { first, second, more: totalCount - 2 });
  }
  return t('feed_story_vote_count', { count: totalCount });
}

export function formatReputation(n: number | undefined, locale: LocaleId): string | null {
  if (n == null || Number.isNaN(n)) {
    return null;
  }
  return n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePayoutNumber(s: string | undefined): number {
  if (s == null || s.trim() === '') {
    return 0;
  }
  const m = s.match(/-?[\d.]+/);
  if (!m) {
    return 0;
  }
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Shows the larger of pending vs total payout (Hive-style strings).
 */
export function formatPayoutDisplay(
  pendingPayout: string | undefined,
  totalPayout: string | undefined,
): string | null {
  const p = parsePayoutNumber(pendingPayout);
  const t = parsePayoutNumber(totalPayout);
  const v = Math.max(p, t);
  if (v <= 0) {
    return null;
  }
  return `$ ${v.toFixed(2)}`;
}
