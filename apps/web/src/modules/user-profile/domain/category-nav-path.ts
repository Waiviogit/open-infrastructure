/** Single URL segment for "objects with no category"; reserved path (not a department name). */
export const UNCATEGORIZED_SHOP_PATH_SEGMENT = 'uncategorized';

/** Decode one URL path segment (pathname or dynamic param). */
export function decodeCategoryPathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Maps full URL lineage to query-api `name` + `path` (parent node for the listing). */
export function apiNavContextFromLineage(lineage: readonly string[]): {
  parentName?: string;
  path: string[];
} {
  if (lineage.length === 0) {
    return { parentName: undefined, path: [] };
  }
  return {
    parentName: lineage[lineage.length - 1],
    path: lineage.slice(0, -1),
  };
}
