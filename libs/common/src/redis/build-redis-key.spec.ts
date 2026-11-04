import { buildRedisKey } from './build-redis-key';

describe('buildRedisKey', () => {
  it('joins app, purpose and segments with colons', () => {
    expect(buildRedisKey('chain-indexer', 'cache', 'block', 12345)).toBe(
      'chain-indexer:cache:block:12345',
    );
  });

  it('works without extra segments', () => {
    expect(buildRedisKey('query-api', 'lock')).toBe('query-api:lock');
  });
});
