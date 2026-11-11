import { isUserProfileReservedFirstSegment } from './profile-path';

describe('profile-path reserved segments', () => {
  it('treats messages as reserved profile first segment', () => {
    expect(isUserProfileReservedFirstSegment('messages')).toBe(true);
  });

  it('treats permissions as reserved profile first segment', () => {
    expect(isUserProfileReservedFirstSegment('permissions')).toBe(true);
  });

  it('treats favorites as reserved profile first segment', () => {
    expect(isUserProfileReservedFirstSegment('favorites')).toBe(true);
  });

  it('no longer reserves the removed shop and recipe tabs (they are post permlinks)', () => {
    expect(isUserProfileReservedFirstSegment('user-shop')).toBe(false);
    expect(isUserProfileReservedFirstSegment('recipe')).toBe(false);
  });
});
