import type { ObjectSearchDocument } from '../document';

/** Documents to write and object ids whose document must be removed. */
export interface ObjectSearchSinkBatch {
  upserts: readonly ObjectSearchDocument[];
  deleteIds: readonly string[];
}

export interface ObjectSearchSinkOptions {
  /** Rewrite documents even when their content hash is unchanged. */
  force?: boolean;
}

/**
 * Where search documents are written. The worker and the rebuild command only build documents and
 * hand them to every sink; Postgres (`object_search_docs`) is the first one, a search engine would
 * be another.
 * @see docs/architecture/adr/search-read-model.md
 */
export interface ObjectSearchSink {
  apply(
    batch: ObjectSearchSinkBatch,
    options?: ObjectSearchSinkOptions,
  ): Promise<void>;
}

/** Nest DI token: `ObjectSearchSink[]`. */
export const OBJECT_SEARCH_SINKS = Symbol('OBJECT_SEARCH_SINKS');
