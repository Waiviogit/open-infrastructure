import { UPDATE_TYPES } from '../update-registry/update-types';
import { OBJECT_TYPE_REGISTRY } from './object-type-registry';

/**
 * Object types whose registry definition supports the `category` update, sorted.
 * Derived from {@link OBJECT_TYPE_REGISTRY}: adding `category` to a type's `supported_updates`
 * makes it a category type everywhere (indexer scopes, query-api, web navigation).
 */
export const CATEGORY_OBJECT_TYPES: readonly string[] = Object.values(OBJECT_TYPE_REGISTRY)
  .filter((definition) => definition.supported_updates.includes(UPDATE_TYPES.CATEGORY))
  .map((definition) => definition.object_type)
  .sort();

const CATEGORY_OBJECT_TYPE_SET: ReadonlySet<string> = new Set(CATEGORY_OBJECT_TYPES);

/** True when `objectType` supports the `category` update in the registry. */
export function objectTypeSupportsCategories(objectType: string): boolean {
  return CATEGORY_OBJECT_TYPE_SET.has(objectType.trim());
}
