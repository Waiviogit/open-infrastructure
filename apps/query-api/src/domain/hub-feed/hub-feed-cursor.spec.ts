import {
  decodeHubFeedCursor,
  encodeHubFeedCursor,
  hubActivityCursorSchema,
  hubScoreCursorSchema,
  hubTimeCursorSchema,
} from './hub-feed-cursor';

describe('hub feed cursor', () => {
  it('round-trips a payload for the same filter', () => {
    const payload = { feedAt: 100, author: 'alice', permlink: 'p1' };
    const raw = encodeHubFeedCursor('new', payload);
    expect(decodeHubFeedCursor(raw, 'new', hubTimeCursorSchema)).toEqual(payload);
  });

  it('keeps bigint scores as exact strings', () => {
    const payload = { score: '123456789012345678901', author: 'a', permlink: 'p', windowStart: 10 };
    const raw = encodeHubFeedCursor('trending', payload);
    expect(decodeHubFeedCursor(raw, 'trending', hubScoreCursorSchema)?.score).toBe(
      '123456789012345678901',
    );
  });

  it('rejects a cursor issued for another filter', () => {
    const raw = encodeHubFeedCursor('author:alice', { feedAt: 1, author: 'a', permlink: 'p' });
    expect(decodeHubFeedCursor(raw, 'author:bob', hubTimeCursorSchema)).toBeNull();
    expect(decodeHubFeedCursor(raw, 'new', hubTimeCursorSchema)).toBeNull();
  });

  it('rejects malformed cursors and wrong payload shapes', () => {
    expect(decodeHubFeedCursor('not-base64-json', 'new', hubTimeCursorSchema)).toBeNull();
    const raw = encodeHubFeedCursor('new', { createdAtUnix: 1, eventSeq: '5' });
    expect(decodeHubFeedCursor(raw, 'new', hubTimeCursorSchema)).toBeNull();
    expect(decodeHubFeedCursor(raw, 'new', hubActivityCursorSchema)).toEqual({
      createdAtUnix: 1,
      eventSeq: '5',
    });
  });
});
