import {
  buildFavoritesPath,
  isUncategorizedLineage,
  parseFavoritesPath,
  readFavoritesOtherParam,
  resolveFavoritesCategoryView,
} from './favorites-path';

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
      });
    });

    it('parses type and decoded lineage on public and internal URLs', () => {
      const expected = {
        objectType: 'recipe',
        lineage: ['German Cuisine', 'Comfort Food'],
      };
      expect(parseFavoritesPath('/@alice/favorites/recipe/German%20Cuisine/Comfort%20Food')).toEqual(
        expected,
      );
      expect(
        parseFavoritesPath('/user-profile/alice/favorites/recipe/German%20Cuisine/Comfort%20Food'),
      ).toEqual(expected);
    });

    it('keeps the legacy uncategorized segment in the lineage (resolved as the root Other)', () => {
      expect(parseFavoritesPath('/@alice/favorites/book/uncategorized')).toEqual({
        objectType: 'book',
        lineage: ['uncategorized'],
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
      });
    });
  });

  it('isUncategorizedLineage matches only the single reserved segment', () => {
    expect(isUncategorizedLineage(['uncategorized'])).toBe(true);
    expect(isUncategorizedLineage(['Food', 'uncategorized'])).toBe(false);
    expect(isUncategorizedLineage([])).toBe(false);
  });

  describe('category view (the Other category)', () => {
    it('reads ?other=1 from page searchParams and URLSearchParams', () => {
      expect(readFavoritesOtherParam({ other: '1' })).toBe(true);
      expect(readFavoritesOtherParam({ other: ['1'] })).toBe(true);
      expect(readFavoritesOtherParam(new URLSearchParams('other=1&tags=a:b'))).toBe(true);
      expect(readFavoritesOtherParam({ other: 'true' })).toBe(false);
      expect(readFavoritesOtherParam({})).toBe(false);
    });

    it('is the Other of the lineage with ?other=1, and the root Other for the legacy link', () => {
      expect(resolveFavoritesCategoryView(['Women', 'Outerwear'], true)).toEqual({
        lineage: ['Women', 'Outerwear'],
        other: true,
      });
      expect(resolveFavoritesCategoryView(['Women'], false)).toEqual({ lineage: ['Women'], other: false });
      expect(resolveFavoritesCategoryView(['uncategorized'], false)).toEqual({ lineage: [], other: true });
    });
  });
});
