import { buildFavoritesPath, isUncategorizedLineage, parseFavoritesPath } from './favorites-path';

describe('favorites-path', () => {
  describe('parseFavoritesPath', () => {
    it('returns null outside the Favorites tab', () => {
      expect(parseFavoritesPath('/@alice')).toBeNull();
      expect(parseFavoritesPath('/@alice/threads')).toBeNull();
      expect(parseFavoritesPath('/@alice/recipe')).toBeNull();
      expect(parseFavoritesPath('/discover')).toBeNull();
    });

    it('parses bare /favorites without a type', () => {
      expect(parseFavoritesPath('/@alice/favorites')).toEqual({
        objectType: null,
        lineage: [],
        uncategorizedOnly: false,
      });
    });

    it('parses type and decoded lineage on public and internal URLs', () => {
      const expected = {
        objectType: 'recipe',
        lineage: ['German Cuisine', 'Comfort Food'],
        uncategorizedOnly: false,
      };
      expect(parseFavoritesPath('/@alice/favorites/recipe/German%20Cuisine/Comfort%20Food')).toEqual(
        expected,
      );
      expect(
        parseFavoritesPath('/user-profile/alice/favorites/recipe/German%20Cuisine/Comfort%20Food'),
      ).toEqual(expected);
    });

    it('flags the Uncategorized node', () => {
      expect(parseFavoritesPath('/@alice/favorites/book/uncategorized')).toEqual({
        objectType: 'book',
        lineage: ['uncategorized'],
        uncategorizedOnly: true,
      });
    });

    it('keeps a malformed escape as-is instead of throwing', () => {
      expect(parseFavoritesPath('/@alice/favorites/recipe/50%')?.lineage).toEqual(['50%']);
    });
  });

  describe('buildFavoritesPath', () => {
    it('builds the bare tab URL', () => {
      expect(buildFavoritesPath('alice')).toBe('/@alice/favorites');
      expect(buildFavoritesPath('alice', '  ')).toBe('/@alice/favorites');
    });

    it('encodes type and lineage segments', () => {
      expect(buildFavoritesPath('alice', 'recipe', ['German Cuisine', 'A/B'])).toBe(
        '/@alice/favorites/recipe/German%20Cuisine/A%2FB',
      );
    });

    it('round-trips through parseFavoritesPath', () => {
      const lineage = ['Café & Bar', 'Comfort Food'];
      expect(parseFavoritesPath(buildFavoritesPath('alice', 'place', lineage))).toEqual({
        objectType: 'place',
        lineage,
        uncategorizedOnly: false,
      });
    });
  });

  it('isUncategorizedLineage matches only the single reserved segment', () => {
    expect(isUncategorizedLineage(['uncategorized'])).toBe(true);
    expect(isUncategorizedLineage(['Food', 'uncategorized'])).toBe(false);
    expect(isUncategorizedLineage([])).toBe(false);
  });
});
