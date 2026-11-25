import { sql, type RawBuilder } from 'kysely';

import type { DiscoverBox } from '../domain/discover/discover-query.schema';
import { buildObjectSearchDocsFilter } from './object-search-filters.sql';

/**
 * WHERE fragments for Discover object filters on alias `oc` (`objects_core`). Each builder
 * returns `AND …` or an empty fragment. Shared by the Discover object feed, the tag facets and
 * the Discover category tree. Text and map box go through the search documents
 * (`object-search-filters.sql.ts`); tags and categories stay on their own tables.
 */

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
  /**
   * The virtual Other category of `categoryPath`: the shown child names. A group is left out when
   * any of its active objects carries the lineage and one of these names.
   */
  excludedCategoryNames?: readonly string[];
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
 * Other of a level: drops objects whose group (the object itself, or any active object of its
 * `meta_group_id`) carries the lineage and one of `excludedNames`, so a group shown under a child
 * category never shows under Other (counts are in groups).
 */
export function buildDiscoverExcludedCategoriesFilter(
  categoryPath: readonly string[],
  excludedNames: readonly string[] | undefined,
): RawBuilder<unknown> {
  if (!excludedNames || excludedNames.length === 0) {
    return sql``;
  }
  const path = [...categoryPath];
  const names = [...excludedNames];
  return sql`AND NOT EXISTS (
    SELECT 1 FROM object_categories cat_ex
    WHERE cat_ex.object_id = oc.object_id
      AND cat_ex.category_names @> ${path}::text[]
      AND cat_ex.category_names && ${names}::text[]
  )
  AND NOT (
    oc.meta_group_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM objects_core sibling
      INNER JOIN object_categories cat_ex ON cat_ex.object_id = sibling.object_id
      WHERE sibling.meta_group_id = oc.meta_group_id
        AND sibling.status = 'active'
        AND cat_ex.category_names @> ${path}::text[]
        AND cat_ex.category_names && ${names}::text[]
    )
  )`;
}

/**
 * Every Discover filter, as `AND …` fragments on alias `oc` (status and type not included).
 * `objectType` may be empty (untyped Discover): the search documents are then not narrowed by
 * type. `null` when the text query can match nothing.
 */
export function buildDiscoverObjectFilters(params: DiscoverObjectFilterParams): RawBuilder<unknown> | null {
  const searchDocsFilter = buildObjectSearchDocsFilter({
    objectIdColumn: sql.ref('oc.object_id'),
    objectType: params.objectType,
    q: params.q,
    box: params.box,
  });
  if (searchDocsFilter == null) {
    return null;
  }
  return sql`
    ${searchDocsFilter}
    ${buildDiscoverTagFilter(params.tags, params.objectType)}
    ${buildDiscoverCategoryPathFilter(params.categoryPath)}
    ${buildDiscoverExcludedCategoriesFilter(params.categoryPath, params.excludedCategoryNames)}
  `;
}
