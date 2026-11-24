import type { Translate } from '@/i18n/types';

/** Human-readable label for how many `object_updates` rows exist for a type. */
export function formatUpdateCountLabel(count: number, t: Translate): string {
  return t('object_edit_update_count', { count });
}
