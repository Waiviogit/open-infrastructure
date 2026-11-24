/** Max resolved category strings stored per object after `ObjectViewService`. */
export const MAX_CATEGORIES_PER_OBJECT = 15;

/** Default batch size when claiming `object_categories_sync_queue` rows. */
export const OBJECT_CATEGORIES_WORKER_BATCH_SIZE = 20;

/** Default batch size when claiming `object_categories_related_sync_queue` rows. */
export const OBJECT_CATEGORIES_RELATED_WORKER_BATCH_SIZE = 5;

/** Seconds before a failed queue row can be claimed again. */
export const OBJECT_CATEGORIES_RETRY_AFTER_SEC = 60;

/** Interval name for SchedulerRegistry (object categories worker). */
export const OBJECT_CATEGORIES_WORKER_INTERVAL_NAME = 'objectCategoriesWorker';

/** Interval name for SchedulerRegistry (related aggregation worker). */
export const OBJECT_CATEGORIES_RELATED_WORKER_INTERVAL_NAME =
  'objectCategoriesRelatedWorker';

/**
 * Rows per INSERT when replacing an `object_categories_related` scope. Each row binds 6 values;
 * 1000 rows stay far below the Postgres limit of 65535 bind parameters.
 */
export const OBJECT_CATEGORIES_RELATED_INSERT_CHUNK_ROWS = 1000;

/**
 * Minimum seconds between two rebuilds of one type scope (`scope_type = 'type'`). A type scope
 * aggregates every active object of the type; without this a busy type would be rebuilt on every
 * worker tick. Changes in between stay queued and are picked up by the next rebuild.
 */
export const CATEGORY_TYPE_SCOPE_MIN_INTERVAL_SEC = 600;
