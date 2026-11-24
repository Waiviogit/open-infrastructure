import { createTranslator } from '@/i18n/domain/create-translator';

import { formatVoteSummary } from './story-utils';

describe('formatVoteSummary', () => {
  const t = createTranslator(
    {
      feed_story_vote_summary_single: '@{first} liked this',
      feed_story_vote_summary_pair: '@{first} and @{second} liked this',
      feed_story_vote_summary_more: '@{first}, @{second} and {more} more liked this',
      feed_story_vote_count_one: '{count} like',
      feed_story_vote_count_other: '{count} likes',
    },
    'en-US',
  );

  it('returns null without likes', () => {
    expect(formatVoteSummary(0, ['alice'], t)).toBeNull();
  });

  it('names a single voter', () => {
    expect(formatVoteSummary(1, ['alice'], t)).toBe('@alice liked this');
  });

  it('names a pair of voters', () => {
    expect(formatVoteSummary(2, ['alice', 'bob'], t)).toBe('@alice and @bob liked this');
  });

  it('names two voters and counts the rest', () => {
    expect(formatVoteSummary(5, ['alice', 'bob'], t)).toBe('@alice, @bob and 3 more liked this');
  });

  it('falls back to the plural count when names are missing', () => {
    expect(formatVoteSummary(1, [], t)).toBe('1 like');
    expect(formatVoteSummary(2, ['alice'], t)).toBe('2 likes');
    expect(formatVoteSummary(7, [], t)).toBe('7 likes');
  });
});
