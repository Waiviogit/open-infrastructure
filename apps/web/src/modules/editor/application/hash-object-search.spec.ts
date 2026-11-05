import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';

import type { PlaceSearchItem } from '../domain/place.schema';
import { buildHashSearchEntries, matchHashObjectQuery } from './hash-object-search';

function object(id: string): SearchObjectResult {
  return { object_id: id, object_type: 'restaurant', name: id, image_url: null, parent_name: null };
}

function place(id: string, existing: string | null = null): PlaceSearchItem {
  return {
    place_id: id,
    name: `Place ${id}`,
    formatted_address: null,
    latitude: null,
    longitude: null,
    primary_type: null,
    suggested_object_type: 'restaurant',
    existing_object_id: existing,
  };
}

describe('matchHashObjectQuery', () => {
  it('captures a multi-word query after #', () => {
    expect(matchHashObjectQuery('eat at #pizza hut')).toEqual({
      leadOffset: 7,
      matchingString: 'pizza hut',
      replaceableString: '#pizza hut',
    });
  });

  it('opens on a bare # with an empty query', () => {
    expect(matchHashObjectQuery('#')?.matchingString).toBe('');
  });

  it('keeps matching while the user types a space between words', () => {
    expect(matchHashObjectQuery('#pizza ')?.matchingString).toBe('pizza ');
  });

  it('ignores # inside a word', () => {
    expect(matchHashObjectQuery('abc#def')).toBeNull();
  });

  it('stops at a double space', () => {
    expect(matchHashObjectQuery('#pizza  ')).toBeNull();
  });

  it('stops at sentence punctuation', () => {
    expect(matchHashObjectQuery('#pizza.')).toBeNull();
  });

  it('does not follow queries longer than 75 characters', () => {
    expect(matchHashObjectQuery(`#${'a'.repeat(76)}`)).toBeNull();
  });
});

describe('buildHashSearchEntries', () => {
  it('lists our objects before Google places and drops a place whose object is already listed', () => {
    const entries = buildHashSearchEntries(
      [object('abc-cafe')],
      [place('ChIJabc', 'abc-cafe'), place('ChIJxyz')],
    );

    expect(entries.map((e) => e.key)).toEqual(['object:abc-cafe', 'place:ChIJxyz']);
  });

  it('shows a linked place as its existing object, above new places', () => {
    const entries = buildHashSearchEntries([], [place('ChIJnew'), place('ChIJabc', 'abc-cafe')]);

    expect(entries.map((e) => [e.kind, e.key])).toEqual([
      ['linked-place', 'object:abc-cafe'],
      ['place', 'place:ChIJnew'],
    ]);
  });

  it('never offers creation for a place that already has an object', () => {
    const entries = buildHashSearchEntries([], [place('ChIJabc', 'abc-cafe')]);

    expect(entries.some((e) => e.kind === 'place')).toBe(false);
  });

  it('lists two places linked to the same object once', () => {
    const entries = buildHashSearchEntries(
      [],
      [place('ChIJ1', 'abc-cafe'), place('ChIJ2', 'abc-cafe')],
    );

    expect(entries).toHaveLength(1);
  });
});
