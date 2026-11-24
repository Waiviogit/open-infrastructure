/**
 * Box of the mobile toolbar pills (current category `All ▾`, Filter, the hub Feed filter
 * trigger): one border width, padding and type size, so pills on the same row are the same height.
 */
const MOBILE_PILL_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-pill border px-3 py-1 text-body-sm font-weight-label text-accent';

/** Tinted pill naming the current choice; opens its menu or drawer (category, feed filter). */
export const MOBILE_MENU_PILL_CLASS = `${MOBILE_PILL_BASE_CLASS} min-w-0 border-transparent bg-accent-soft`;

/** Outlined action pill (Filter). */
export const MOBILE_ACTION_PILL_CLASS = `${MOBILE_PILL_BASE_CLASS} border-accent`;
