/** Max rows in top-level shop department list before folding into Other. */
export const ROOT_DEPARTMENTS_LIMIT = 20;

/**
 * Client display rule: a category with fewer scope units (objects, or groups for a type scope)
 * than this is not shown, at any level.
 */
export const CATEGORY_MIN_OBJECTS = 3;

/**
 * Client display rule: a category covering more than this share of the current level's units
 * (scope + lineage + filters, uncategorized included) is not shown, at any level.
 */
export const CATEGORY_MAX_SHARE = 0.6;

/** Two categories are suppressed as duplicates when their unit sets differ by less than this. */
export const NEAR_DUPLICATE_TOLERANCE = 10;

/**
 * Type scopes find near-duplicates with live pair counts (k² pairs): only the top this many
 * categories of a level, by count, are compared.
 */
export const NEAR_DUPLICATE_MAX_CANDIDATES = 60;
