import {
  buildProfileShopHref,
  buildShopListScopeKey,
  isUserProfileFavoritesTab,
  parseProfileShopFilters,
  setProfileShopRatingFilter,
  toggleProfileShopTagFilter,
} from './profile-shop-filters-url';

describe('profile-shop-filters-url', () => {
  it('parseProfileShopFilters reads tags and rating', () => {
    const sp = new URLSearchParams();
    sp.append('tags', 'Pros:coffee');
    sp.set('rating', '8');
    expect(parseProfileShopFilters(sp)).toEqual({
      tags: ['Pros:coffee'],
      rating: 8,
    });
  });

  it('buildProfileShopHref preserves pathname', () => {
    expect(
      buildProfileShopHref('/@alice/favorites/recipe', { tags: ['Pros:coffee'], rating: 10 }),
    ).toBe('/@alice/favorites/recipe?tags=Pros%3Acoffee&rating=10');
  });

  it('toggleProfileShopTagFilter adds and removes tags', () => {
    expect(toggleProfileShopTagFilter([], 'Pros:coffee', true)).toEqual(['Pros:coffee']);
    expect(toggleProfileShopTagFilter(['Pros:coffee'], 'Pros:coffee', false)).toEqual([]);
  });

  it('setProfileShopRatingFilter is single-select', () => {
    expect(setProfileShopRatingFilter(null, 10, true)).toBe(10);
    expect(setProfileShopRatingFilter(10, 8, true)).toBe(8);
    expect(setProfileShopRatingFilter(10, 10, false)).toBeNull();
  });

  it('isUserProfileFavoritesTab matches the merged Favorites tab only', () => {
    expect(isUserProfileFavoritesTab('/@alice/favorites')).toBe(true);
    expect(isUserProfileFavoritesTab('/@alice/favorites/recipe/Desserts')).toBe(true);
    expect(isUserProfileFavoritesTab('/user-profile/alice/favorites/place')).toBe(true);
    expect(isUserProfileFavoritesTab('/@alice/user-shop')).toBe(false);
    expect(isUserProfileFavoritesTab('/@alice/recipe')).toBe(false);
  });

  it('buildShopListScopeKey encodes type, path, uncategorized, and filters', () => {
    expect(
      buildShopListScopeKey('recipe', ['Desserts'], false, { tags: ['Cuisine:asian'], rating: 8 }),
    ).toBe('recipe::Desserts::Cuisine:asian::8');
    expect(buildShopListScopeKey('book', [], true, { tags: [], rating: null })).toBe(
      'book::__uncategorized__::::',
    );
    expect(buildShopListScopeKey('book', [], false, { tags: [], rating: null })).not.toBe(
      buildShopListScopeKey('product', [], false, { tags: [], rating: null }),
    );
  });
});
