import { isPathnameWithinObjectPage } from './object-page-path';

describe('isPathnameWithinObjectPage', () => {
  const objectId = 'yrc-spaghetti-carbonara';

  it('accepts the object root and its sub-routes', () => {
    expect(isPathnameWithinObjectPage(objectId, '/object/yrc-spaghetti-carbonara')).toBe(true);
    expect(isPathnameWithinObjectPage(objectId, '/object/yrc-spaghetti-carbonara/reviews')).toBe(
      true,
    );
    expect(
      isPathnameWithinObjectPage(objectId, '/object/yrc-spaghetti-carbonara/gallery/album/x'),
    ).toBe(true);
  });

  it('rejects intercepted post overlay paths', () => {
    expect(isPathnameWithinObjectPage(objectId, '/@alice/some-post')).toBe(false);
    expect(isPathnameWithinObjectPage(objectId, '/user-profile/alice/post/some-post')).toBe(false);
  });

  it('rejects other objects sharing the id prefix', () => {
    expect(isPathnameWithinObjectPage(objectId, '/object/yrc-spaghetti-carbonara-2')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isPathnameWithinObjectPage(objectId, null)).toBe(false);
    expect(isPathnameWithinObjectPage(objectId, '')).toBe(false);
  });
});
