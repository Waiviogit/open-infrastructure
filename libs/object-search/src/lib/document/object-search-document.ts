import { UPDATE_TYPES } from '@opden-data-layer/core';

/** WGS 84 point of an object (the winning `geo` update). */
export interface ObjectSearchGeoPoint {
  longitude: number;
  latitude: number;
}

/**
 * Engine-neutral search document of one active object. Built by `buildObjectSearchDocument`,
 * written by every `ObjectSearchSink`; texts are raw (each sink normalizes what it indexes).
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
export interface ObjectSearchDocument {
  objectId: string;
  objectType: string;
  /** `meta_group_id ?? object_id`: search returns one object per group. */
  groupKey: string;
  weight: number | null;
  createdAt: Date;
  /** Winning `name` for the default locale; null when the object has none. */
  name: string | null;
  /** Winning names of every locale present (includes `name`). */
  names: string[];
  titles: string[];
  descriptions: string[];
  /** Valid `identifier` values, deduplicated and sorted. */
  identifiers: string[];
  /** Winning `address.locality`. */
  locality: string | null;
  geo: ObjectSearchGeoPoint | null;
}

/** Update types a search document reads; a change of any of them refreshes the document. */
export const SEARCH_DOC_UPDATE_TYPES: readonly string[] = [
  UPDATE_TYPES.NAME,
  UPDATE_TYPES.TITLE,
  UPDATE_TYPES.DESCRIPTION,
  UPDATE_TYPES.IDENTIFIER,
  UPDATE_TYPES.ADDRESS,
  UPDATE_TYPES.GEO,
];

/** Localizable text types: resolved once per locale present on the object. */
export const SEARCH_DOC_LOCALIZED_UPDATE_TYPES: readonly string[] = [
  UPDATE_TYPES.NAME,
  UPDATE_TYPES.TITLE,
  UPDATE_TYPES.DESCRIPTION,
];

/** Longer descriptions are cut before indexing. */
export const SEARCH_DOC_DESCRIPTION_MAX_CHARS = 5000;

/**
 * Bump whenever normalization or the vector composition changes: every content hash changes, so
 * `pnpm search-docs:rebuild --all` rewrites every document.
 */
export const SEARCH_DOC_FORMAT_VERSION = 1;

/** Locale the base view is resolved for (the API default). */
export const SEARCH_DOC_DEFAULT_LOCALE = 'en-US';

/**
 * A locale no update carries: resolving with it yields the fallback winner that viewers of
 * locales without their own value see.
 */
export const SEARCH_DOC_UNMATCHED_LOCALE = 'zxx-x-search-fallback';
