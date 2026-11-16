/**
 * Layout stability of the Favorites tab. The center column starts with a one-line breadcrumb row
 * of fixed height; the breadcrumbs, their skeletons (route `loading.tsx` and the instant-nav
 * overlay) all use this class, so the content below never moves while a navigation is pending.
 */
export const FAVORITES_CRUMBS_ROW_CLASS = 'mb-card-padding flex h-6 min-w-0 items-center';

/**
 * Favorites left rail (categories of the active type). It stays in page flow — not sticky, no
 * `max-h`, no own scroll — so a long category list grows the page and scrolls with it.
 */
export const FAVORITES_LEFT_RAIL_FLOW_CLASS = 'relative z-0 min-w-0 w-full self-start';

/** Card of the Favorites left rail and its skeleton. */
export const FAVORITES_LEFT_RAIL_CARD_CLASS =
  'rounded-card border border-border bg-surface/60 p-card-padding';
