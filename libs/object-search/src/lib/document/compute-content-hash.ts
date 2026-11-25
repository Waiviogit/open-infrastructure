import { createHash } from 'node:crypto';

import {
  SEARCH_DOC_FORMAT_VERSION,
  type ObjectSearchDocument,
} from './object-search-document';

/**
 * SHA-1 of the format version and every field except `weight` (a fixed-order JSON array, so the
 * hash is stable). Equal hashes mean the indexed content is unchanged; a weight-only change keeps
 * the hash and is written without touching the text index.
 */
export function computeContentHash(doc: ObjectSearchDocument): string {
  const stable = JSON.stringify([
    SEARCH_DOC_FORMAT_VERSION,
    doc.objectId,
    doc.objectType,
    doc.groupKey,
    doc.createdAt.toISOString(),
    doc.name,
    doc.names,
    doc.titles,
    doc.descriptions,
    doc.identifiers,
    doc.locality,
    doc.geo ? [doc.geo.longitude, doc.geo.latitude] : null,
  ]);
  return createHash('sha1').update(stable).digest('hex');
}
