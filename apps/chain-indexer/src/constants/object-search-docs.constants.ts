/** Interval name for SchedulerRegistry (object search documents worker). */
export const OBJECT_SEARCH_DOCS_WORKER_INTERVAL_NAME = 'objectSearchDocsWorker';

/** Seconds before a failed or interrupted `object_search_docs_sync_queue` row can be claimed again. */
export const OBJECT_SEARCH_DOCS_RETRY_AFTER_SEC = 60;

/** Default worker tick interval (`OBJECT_SEARCH_DOCS_INTERVAL_MS`). */
export const OBJECT_SEARCH_DOCS_DEFAULT_INTERVAL_MS = 3_000;

/** Default queue rows claimed per batch (`OBJECT_SEARCH_DOCS_BATCH_SIZE`). */
export const OBJECT_SEARCH_DOCS_DEFAULT_BATCH_SIZE = 200;

/** Default batches drained per tick while batches come back full (`OBJECT_SEARCH_DOCS_MAX_BATCHES_PER_TICK`). */
export const OBJECT_SEARCH_DOCS_DEFAULT_MAX_BATCHES_PER_TICK = 10;
