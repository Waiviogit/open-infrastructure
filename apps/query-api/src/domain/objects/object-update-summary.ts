import type { ObjectUpdate } from '@opden-data-layer/odl-db-types';

export interface ObjectUpdateSummary {
  /** Row count per `update_type`, over every stored update (any validity). */
  update_type_counts: Record<string, number>;
  /** Distinct non-empty `locale` values, ascending. */
  update_locales: string[];
}

/**
 * Update-type counts and locales of one object from its already loaded update rows
 * (`AggregatedObjectRepository.loadByObjectIds` loads them unfiltered), instead of two more queries.
 */
export function summarizeObjectUpdates(
  updates: ReadonlyArray<Pick<ObjectUpdate, 'update_type' | 'locale'>>,
): ObjectUpdateSummary {
  const counts: Record<string, number> = {};
  const locales = new Set<string>();
  for (const update of updates) {
    counts[update.update_type] = (counts[update.update_type] ?? 0) + 1;
    if (update.locale != null && update.locale.length > 0) {
      locales.add(update.locale);
    }
  }
  return {
    update_type_counts: counts,
    update_locales: [...locales].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
}
