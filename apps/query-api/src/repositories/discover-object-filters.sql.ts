import { UPDATE_TYPES } from '@opden-data-layer/core';
import { sql, type RawBuilder } from 'kysely';

import type { DiscoverBox } from '../domain/discover/discover-query.schema';
import { buildAutocompleteTsQuery } from './search-fts.utils';
import { prefixUpperBound, shouldSearchObjectIdSubstring, shouldSearchPrefix } from './search-prefix.utils';

/**
 * WHERE fragments for Discover object filters on alias `oc` (`objects_core`). Each builder
 * returns `AND …` or an empty fragment. Shared by the Discover object feed, the tag facets and
 * the Discover category tree.
 */

const FTS_TEXT_UPDATE_TYPES = [
  UPDATE_TYPES.NAME,
  UPDATE_TYPES.TITLE,
  UPDATE_TYPES.DESCRIPTION,
] as const;

export interface DiscoverTagFilter {
  category: string;
  value: string;
}

/** Filters a Discover listing narrows one object type by. */
export interface DiscoverObjectFilterParams {
  objectType: string;
  q: string;
  tags: readonly DiscoverTagFilter[];
  box: DiscoverBox | null | undefined;
  /** Category lineage; objects must carry every name (`category_names @> path`). */
  categoryPath: readonly string[];
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** False when `q` can match nothing (no FTS terms, too short for prefix / id search). */
export function canDiscoverObjectTextSearch(qTrimmed: string): boolean {
  if (qTrimmed.length === 0) {
    return true;
  }
  const tsQueryCheck = buildAutocompleteTsQuery(qTrimmed);
  return (
    tsQueryCheck !== null ||
    shouldSearchObjectIdSubstring(qTrimmed) ||
    shouldSearchPrefix(qTrimmed)
  );
}

/** Text match on name/title/description FTS, name prefix, identifier/locality prefix, id. */
export function buildDiscoverObjectTextMatchFilter(qTrimmed: string): RawBuilder<unknown> {
  if (qTrimmed.length === 0) {
    return sql``;
  }
  const tsQuery = buildAutocompleteTsQuery(qTrimmed);
  const includeIdSubstring = shouldSearchObjectIdSubstring(qTrimmed);
  const idSubstringPattern = `%${escapeIlikePattern(qTrimmed)}%`;

  const parts: RawBuilder<unknown>[] = [];

  if (shouldSearchPrefix(qTrimmed)) {
    const prefixLower = qTrimmed.toLowerCase();
    const prefixUpper = prefixUpperBound(prefixLower);
    const prefixPattern = `${escapeIlikePattern(prefixLower)}%`;
    parts.push(
      sql`(oc.object_id COLLATE "C" >= ${prefixLower} AND oc.object_id COLLATE "C" < ${prefixUpper})`,
    );
    parts.push(sql`EXISTS (
      SELECT 1 FROM object_updates ou_name
      WHERE ou_name.object_id = oc.object_id
        AND ou_name.update_type IN (${FTS_TEXT_UPDATE_TYPES[0]}, ${FTS_TEXT_UPDATE_TYPES[1]})
        AND ou_name.value_text_normalized LIKE ${prefixPattern} ESCAPE '\\'
    )`);
    parts.push(sql`EXISTS (
      SELECT 1 FROM object_updates ou_identifier
      WHERE ou_identifier.object_id = oc.object_id
        AND ou_identifier.update_type = ${UPDATE_TYPES.IDENTIFIER}
        AND lower(ou_identifier.value_json->>'value') LIKE ${prefixPattern} ESCAPE '\\'
    )`);
    parts.push(sql`EXISTS (
      SELECT 1 FROM object_updates ou_locality
      WHERE ou_locality.object_id = oc.object_id
        AND ou_locality.update_type = ${UPDATE_TYPES.ADDRESS}
        AND lower(ou_locality.value_json->>'locality') LIKE ${prefixPattern} ESCAPE '\\'
    )`);
  }

  if (includeIdSubstring) {
    parts.push(sql`oc.object_id ILIKE ${idSubstringPattern} ESCAPE '\\'`);
  }

  if (tsQuery != null) {
    parts.push(sql`EXISTS (
      SELECT 1 FROM object_updates ou_fts
      WHERE ou_fts.object_id = oc.object_id
        AND ou_fts.update_type IN (${FTS_TEXT_UPDATE_TYPES[0]}, ${FTS_TEXT_UPDATE_TYPES[1]}, ${FTS_TEXT_UPDATE_TYPES[2]})
        AND ou_fts.search_vector @@ to_tsquery('english', ${tsQuery})
    )`);
  }

  if (parts.length === 0) {
    return sql`AND false`;
  }

  return sql`AND (${sql.join(parts, sql` OR `)})`;
}

/** AND of `tagCategoryItem` matches (`category:value`); `objectType` narrows the index lookup. */
export function buildDiscoverTagFilter(
  tags: readonly DiscoverTagFilter[],
  objectType: string | undefined,
): RawBuilder<unknown> {
  if (tags.length === 0) {
    return sql``;
  }
  const fragments = tags.map(
    ({ category, value }) => sql`EXISTS (
      SELECT 1 FROM object_tag_category_items tci_tag
      WHERE tci_tag.object_id = oc.object_id
        AND tci_tag.category = ${category}
        AND tci_tag.value = ${value}
        ${objectType ? sql`AND tci_tag.object_type = ${objectType}` : sql``}
    )`,
  );
  return sql`AND ${sql.join(fragments, sql` AND `)}`;
}

/** The object's top-ranked `geo` point lies in `box`. */
export function buildDiscoverGeoBoxFilter(box: DiscoverBox | null | undefined): RawBuilder<unknown> {
  if (!box) {
    return sql``;
  }
  return sql`AND EXISTS (
    SELECT 1 FROM (
      SELECT ou_geo.value_geo
      FROM object_updates ou_geo
      WHERE ou_geo.object_id = oc.object_id
        AND ou_geo.update_type = 'geo'
        AND ou_geo.value_geo IS NOT NULL
      ORDER BY ou_geo.rank_score DESC NULLS LAST, ou_geo.created_at_unix DESC
      LIMIT 1
    ) geo
    WHERE ST_Intersects(
      geo.value_geo::geometry,
      ST_MakeEnvelope(${box.swLng}, ${box.swLat}, ${box.neLng}, ${box.neLat}, 4326)
    )
  )`;
}

/** The object carries every name of `categoryPath` (GIN-eligible `@>`). */
export function buildDiscoverCategoryPathFilter(categoryPath: readonly string[]): RawBuilder<unknown> {
  if (categoryPath.length === 0) {
    return sql``;
  }
  return sql`AND EXISTS (
    SELECT 1 FROM object_categories cat_path
    WHERE cat_path.object_id = oc.object_id
      AND cat_path.category_names @> ${[...categoryPath]}::text[]
  )`;
}

/**
 * Every Discover filter for one object type, as `AND …` fragments on alias `oc` (status and type
 * not included). `null` when the text query can match nothing.
 */
export function buildDiscoverObjectFilters(params: DiscoverObjectFilterParams): RawBuilder<unknown> | null {
  const qTrimmed = params.q.trim();
  if (!canDiscoverObjectTextSearch(qTrimmed)) {
    return null;
  }
  return sql`
    ${buildDiscoverObjectTextMatchFilter(qTrimmed)}
    ${buildDiscoverTagFilter(params.tags, params.objectType)}
    ${buildDiscoverGeoBoxFilter(params.box)}
    ${buildDiscoverCategoryPathFilter(params.categoryPath)}
  `;
}
