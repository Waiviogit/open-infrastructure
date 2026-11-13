import type { HubFeedFollowCountRow } from '../../repositories';
import { buildHubFeedFilterSnapshot, hubFeedCounterWindowStart } from './hub-feed-filter-snapshot';

const user = (id: string, count: number | null, lastItem = 0): HubFeedFollowCountRow => ({
  kind: 'user',
  id,
  object_type: null,
  count,
  last_item_unix: lastItem,
});
const object = (
  id: string,
  type: string,
  count: number | null,
  lastItem = 0,
): HubFeedFollowCountRow => ({ kind: 'object', id, object_type: type, count, last_item_unix: lastItem });

describe('hub feed filter snapshot', () => {
  it('starts the window 71 hours before the current hour', () => {
    expect(hubFeedCounterWindowStart(100 * 3_600 + 59)).toBe(29 * 3_600);
  });

  it('orders accounts by new items, then the most recent item, then name', () => {
    const snapshot = buildHubFeedFilterSnapshot(
      [user('carol', 0, 900), user('bob', 3, 10), user('alice', 3, 10), user('dave', 5, 0), user('erin', 0, 50)],
      10,
      true,
    );
    expect(snapshot.users.map((u) => u.name)).toEqual(['dave', 'alice', 'bob', 'carol', 'erin']);
  });

  it('groups objects by type, sums type counts and orders types by them, then recency', () => {
    const snapshot = buildHubFeedFilterSnapshot(
      [
        object('r1', 'restaurant', 0, 50),
        object('r2', 'restaurant', 2, 1),
        object('d1', 'dish', 4),
        object('r3', 'restaurant', 1, 99),
        object('h1', 'hashtag', 0, 5),
        object('b1', 'book', 0, 7),
      ],
      10,
      true,
    );
    expect(snapshot.objectTypes.map((t) => [t.objectType, t.count])).toEqual([
      ['dish', 4],
      ['restaurant', 3],
      ['book', 0],
      ['hashtag', 0],
    ]);
    expect(snapshot.objectTypes[1].objects.map((o) => o.objectId)).toEqual(['r2', 'r3', 'r1']);
  });

  it('keeps counts null when they could not be computed', () => {
    const snapshot = buildHubFeedFilterSnapshot(
      [user('bob', null, 5), object('r1', 'restaurant', null)],
      10,
      false,
    );
    expect(snapshot.countsAvailable).toBe(false);
    expect(snapshot.users[0].count).toBeNull();
    expect(snapshot.objectTypes[0].count).toBeNull();
    expect(snapshot.objectTypes[0].objects[0].count).toBeNull();
  });
});
