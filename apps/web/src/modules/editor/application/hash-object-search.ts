import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';

import type { PlaceSearchItem } from '../domain/place.schema';

export const HASH_TRIGGER = '#';

/** Longest `#query` the menu follows (place names can have several words). */
export const HASH_QUERY_MAX_LENGTH = 75;

/** Our object search starts at this many characters (same as Insert → Object). */
export const HASH_OBJECT_SEARCH_MIN_LENGTH = 2;

/** Google places are billed per request: longer minimum and debounce. */
export const HASH_PLACE_SEARCH_MIN_LENGTH = 3;

export const HASH_OBJECT_SEARCH_DEBOUNCE_MS = 300;

export const HASH_PLACE_SEARCH_DEBOUNCE_MS = 500;

/**
 * `#` must start the text or follow whitespace / `(` (so `abc#def` and URLs with
 * fragments do not open the menu). The query may contain single spaces but stops
 * at a second `#`, a line break, a double space or sentence punctuation.
 */
const HASH_QUERY_REGEX = new RegExp(
  `(^|\\s|\\()(#((?:[^#\\s.,!?;:()\\[\\]{}<>"]| (?! )){0,${HASH_QUERY_MAX_LENGTH}}))$`,
);

export type HashQueryMatch = {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
};

/** Lexical typeahead trigger: text before the caret → `#query` match or `null`. */
export function matchHashObjectQuery(textBeforeCaret: string): HashQueryMatch | null {
  const match = HASH_QUERY_REGEX.exec(textBeforeCaret);
  if (!match) {
    return null;
  }
  const leading = match[1] ?? '';
  const replaceableString = match[2] ?? '';
  return {
    leadOffset: match.index + leading.length,
    matchingString: match[3] ?? '',
    replaceableString,
  };
}

export type HashSearchEntry =
  | { kind: 'object'; key: string; object: SearchObjectResult }
  /** Google place already created as an ODL object — behaves like an object. */
  | { kind: 'linked-place'; key: string; objectId: string; place: PlaceSearchItem }
  /** Google place without an ODL object — selecting it opens the create confirmation. */
  | { kind: 'place'; key: string; place: PlaceSearchItem };

/**
 * Menu order: our objects first, then Google places. A place that already has an
 * object is never offered for creation; if that object is not in the first
 * section it is listed there (as the existing object), otherwise it is dropped.
 */
export function buildHashSearchEntries(
  objects: readonly SearchObjectResult[],
  places: readonly PlaceSearchItem[],
): HashSearchEntry[] {
  const entries: HashSearchEntry[] = objects.map((object) => ({
    kind: 'object',
    key: `object:${object.object_id}`,
    object,
  }));
  const shownObjectIds = new Set(objects.map((o) => o.object_id));
  const newPlaces: HashSearchEntry[] = [];

  for (const place of places) {
    const objectId = place.existing_object_id;
    if (!objectId) {
      newPlaces.push({ kind: 'place', key: `place:${place.place_id}`, place });
      continue;
    }
    if (shownObjectIds.has(objectId)) {
      continue;
    }
    shownObjectIds.add(objectId);
    entries.push({ kind: 'linked-place', key: `object:${objectId}`, objectId, place });
  }
  return [...entries, ...newPlaces];
}

/** Object row used to insert a link for a place that already has an object. */
export function linkedPlaceToSearchObject(
  objectId: string,
  place: PlaceSearchItem,
): SearchObjectResult {
  return {
    object_id: objectId,
    object_type: place.suggested_object_type,
    name: place.name,
    image_url: null,
    parent_name: null,
  };
}
