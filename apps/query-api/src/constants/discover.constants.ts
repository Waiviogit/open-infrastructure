/** Default page size for discover object feed. */
export const DISCOVER_OBJECTS_DEFAULT_LIMIT = 20;

/** Max page size for discover object feed. */
export const DISCOVER_OBJECTS_MAX_LIMIT = 50;

/** Default page size for discover user list. */
export const DISCOVER_USERS_DEFAULT_LIMIT = 20;

/** Max page size for discover user list. */
export const DISCOVER_USERS_MAX_LIMIT = 50;

/** Redis TTL for aggregated tag categories per object_type (seconds). */
export const DISCOVER_TAG_CATEGORIES_CACHE_TTL_SEC = 300;

/**
 * Redis TTL for the unfiltered Discover category tree level per type and lineage (seconds).
 * Matches the type scope rebuild interval (`CATEGORY_TYPE_SCOPE_MIN_INTERVAL_SEC` in
 * chain-indexer): the candidates cannot change faster than that.
 */
export const DISCOVER_CATEGORIES_CACHE_TTL_SEC = 600;

/** Preview objects per category block of `GET /discover/sections`. */
export const DISCOVER_SECTION_OBJECTS_PER_CATEGORY = 3;

/** Default number of category blocks per `GET /discover/sections` page. */
export const DISCOVER_SECTIONS_DEFAULT_LIMIT = 3;

/** Max number of category blocks per `GET /discover/sections` page. */
export const DISCOVER_SECTIONS_MAX_LIMIT = 10;
