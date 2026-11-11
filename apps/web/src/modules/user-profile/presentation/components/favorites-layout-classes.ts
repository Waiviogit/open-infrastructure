/**
 * Layout stability of the Favorites tab. The center column starts with a one-line breadcrumb row
 * of fixed height; the breadcrumbs, their skeletons (route `loading.tsx` and the instant-nav
 * overlay) all use this class, so the content below never moves while a navigation is pending.
 * Both side rails are offset by exactly that row (+ its bottom margin) on desktop so the rail
 * cards start level with the first content card. Change both constants together.
 */
export const FAVORITES_CRUMBS_ROW_CLASS = 'mb-card-padding flex h-6 min-w-0 items-center';

/** Side-rail top offset (lg+) matching {@link FAVORITES_CRUMBS_ROW_CLASS}. */
export const FAVORITES_SIDE_RAIL_OFFSET_CLASS = 'lg:mt-[calc(theme(spacing.6)+var(--spacing-card))]';
