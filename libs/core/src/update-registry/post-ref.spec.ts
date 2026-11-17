import { formatPostRef, parsePostRef, postRefFromInput } from './post-ref';
import { postRefSchema } from './schemas/string-schemas';

describe('post-ref', () => {
  describe('parsePostRef', () => {
    it('parses a stored author/permlink value', () => {
      expect(parsePostRef('grampo/kopi-talua-egg-coffee')).toEqual({
        author: 'grampo',
        permlink: 'kopi-talua-egg-coffee',
      });
    });

    it('rejects values that are not a Hive account plus one permlink segment', () => {
      expect(parsePostRef('grampo')).toBeNull();
      expect(parsePostRef('/permlink')).toBeNull();
      expect(parsePostRef('grampo/')).toBeNull();
      expect(parsePostRef('Grampo/permlink')).toBeNull();
      expect(parsePostRef('ab/permlink')).toBeNull();
      expect(parsePostRef('grampo/a/b')).toBeNull();
      expect(parsePostRef(`grampo/${'a'.repeat(256)}`)).toBeNull();
    });
  });

  describe('postRefFromInput', () => {
    it('normalizes a post URL', () => {
      expect(postRefFromInput('https://waivio.com/@Grampo/kopi-talua?ref=x#c')).toBe(
        'grampo/kopi-talua',
      );
      expect(postRefFromInput('https://hive.blog/hive-1/@grampo/kopi-talua')).toBe(
        'grampo/kopi-talua',
      );
    });

    it('accepts @author/permlink and author/permlink', () => {
      expect(postRefFromInput('  @grampo/kopi-talua ')).toBe('grampo/kopi-talua');
      expect(postRefFromInput('grampo/kopi-talua')).toBe('grampo/kopi-talua');
    });

    it('returns null for input that does not name a post', () => {
      expect(postRefFromInput('')).toBeNull();
      expect(postRefFromInput('https://waivio.com/object/abc')).toBeNull();
      expect(postRefFromInput('grampo')).toBeNull();
    });
  });

  it('formatPostRef round-trips with parsePostRef', () => {
    const ref = { author: 'grampo', permlink: 'kopi-talua' };
    expect(parsePostRef(formatPostRef(ref))).toEqual(ref);
  });

  it('postRefSchema accepts only author/permlink', () => {
    expect(postRefSchema.safeParse('grampo/kopi-talua').success).toBe(true);
    expect(postRefSchema.safeParse('https://waivio.com/@grampo/kopi-talua').success).toBe(false);
  });
});
