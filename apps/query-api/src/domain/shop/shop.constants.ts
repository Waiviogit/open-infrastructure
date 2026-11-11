/** Sample objects per category row in sections mode (fixed; not the section page size). */
export const SHOP_SECTION_OBJECTS_PER_CATEGORY = 3;

/** Legacy Waivio shop rating filter thresholds (10-point scale; UI shows stars / 2). */
export const SHOP_RATING_FILTER_THRESHOLDS = [10, 8, 6] as const;

export type ShopRatingFilterThreshold = (typeof SHOP_RATING_FILTER_THRESHOLDS)[number];

