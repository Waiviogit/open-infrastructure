import { buildPrefixTsQuery } from '@opden-data-layer/object-search';
import { sql, type RawBuilder } from 'kysely';

import type { DiscoverBox } from '../domain/discover/discover-query.schema';

/** Narrowing of an object set by the search documents: text and / or map box. */
export interface ObjectSearchDocsFilterParams {
  /** Column holding the object id in the caller's query (e.g. `oc.object_id`). */
  objectIdColumn: RawBuilder<unknown>;
  /** Object type of the caller's set; empty = untyped (no type condition). */
  objectType: string;
  q: string;
  box: DiscoverBox | null | undefined;
}

/**
 * `AND <objectIdColumn> IN (SELECT … FROM object_search_docs …)` for a text query and / or a map
 * box. The text condition uses the GIN index on `search_vector`, the box the partial GiST index on
 * `geo`. The caller's set stays driven by its own table (status filter included), so a stale
 * document never surfaces a non-active object.
 *
 * Returns an empty fragment when neither text nor box is given, and `null` when the text has no
 * searchable term (the caller's result is empty).
 * @see docs/apps/query-api/spec/search.md
 */
export function buildObjectSearchDocsFilter(
  params: ObjectSearchDocsFilterParams,
): RawBuilder<unknown> | null {
  const qTrimmed = params.q.trim();
  const tsQuery = qTrimmed.length > 0 ? buildPrefixTsQuery(qTrimmed) : null;
  if (qTrimmed.length > 0 && tsQuery === null) {
    return null;
  }
  const box = params.box ?? null;
  if (tsQuery === null && box === null) {
    return sql``;
  }

  const objectType = params.objectType.trim();
  const conditions: RawBuilder<unknown>[] = [];
  if (objectType.length > 0) {
    conditions.push(sql`d.object_type = ${objectType}`);
  }
  if (tsQuery !== null) {
    conditions.push(sql`d.search_vector @@ to_tsquery('simple', ${tsQuery})`);
  }
  if (box !== null) {
    conditions.push(
      sql`d.geo && ST_MakeEnvelope(${box.swLng}, ${box.swLat}, ${box.neLng}, ${box.neLat}, 4326)`,
    );
  }

  return sql`AND ${params.objectIdColumn} IN (
    SELECT d.object_id FROM object_search_docs d
    WHERE ${sql.join(conditions, sql` AND `)}
  )`;
}
