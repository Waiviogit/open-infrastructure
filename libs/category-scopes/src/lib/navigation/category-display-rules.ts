import {
  CATEGORY_MAX_SHARE,
  CATEGORY_MIN_OBJECTS,
} from './category-navigation.constants';

/**
 * Client display rules for one category of a level: at least {@link CATEGORY_MIN_OBJECTS} units
 * and at most {@link CATEGORY_MAX_SHARE} of the level's `total` units. Objects outside every shown
 * category stay reachable from the level itself (`All` / the type).
 */
export function passesCategoryDisplayRules(
  count: number,
  total: number,
): boolean {
  if (count < CATEGORY_MIN_OBJECTS || total <= 0) {
    return false;
  }
  return count / total <= CATEGORY_MAX_SHARE;
}
