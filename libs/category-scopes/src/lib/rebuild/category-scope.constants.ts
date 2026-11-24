/** `scope_key` of the single global catalogue scope (`scope_type = 'global'`). */
export const GLOBAL_CATEGORY_SCOPE_KEY = '_';

/**
 * Rows per INSERT when replacing an `object_categories_related` scope. Each row binds 7 values;
 * 1000 rows stay far below the Postgres limit of 65535 bind parameters.
 */
export const RELATED_INSERT_CHUNK_ROWS = 1000;

/** Prefix of the advisory lock key taken while one scope's rows are replaced. */
export const SCOPE_LOCK_PREFIX = 'object_categories_related';
