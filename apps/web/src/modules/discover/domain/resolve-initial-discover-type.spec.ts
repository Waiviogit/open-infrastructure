import {
  resolveBareDiscoverRedirectHref,
  resolveInitialDiscoverType,
} from './resolve-initial-discover-type';

describe('resolveInitialDiscoverType', () => {
  it('navigates to remembered type when URL has no type', () => {
    expect(
      resolveInitialDiscoverType({
        objectType: null,
        usersMode: false,
        remembered: 'restaurant',
      }),
    ).toEqual({ action: 'navigate', type: 'restaurant' });
  });

  it('navigates to product when remembered type is invalid', () => {
    expect(
      resolveInitialDiscoverType({
        objectType: null,
        usersMode: false,
        remembered: 'not-a-type',
      }),
    ).toEqual({ action: 'navigate', type: 'product' });
  });

  it('does nothing when URL already has a type', () => {
    expect(
      resolveInitialDiscoverType({
        objectType: 'book',
        usersMode: false,
        remembered: 'restaurant',
      }),
    ).toEqual({ action: 'none' });
  });

  it('does nothing in users mode', () => {
    expect(
      resolveInitialDiscoverType({
        objectType: null,
        usersMode: true,
        remembered: 'restaurant',
      }),
    ).toEqual({ action: 'none' });
  });

  it('navigates to product when no remembered type', () => {
    expect(
      resolveInitialDiscoverType({
        objectType: null,
        usersMode: false,
        remembered: null,
      }),
    ).toEqual({ action: 'navigate', type: 'product' });
  });
});

describe('resolveBareDiscoverRedirectHref', () => {
  it('adds the remembered type and keeps the other filters', () => {
    expect(
      resolveBareDiscoverRedirectHref(
        new URLSearchParams('q=pizza&sort=newest'),
        'restaurant',
      ),
    ).toBe('/discover?type=restaurant&q=pizza&sort=newest');
  });

  it('falls back to the default type', () => {
    expect(resolveBareDiscoverRedirectHref(new URLSearchParams(), null)).toBe(
      '/discover?type=product',
    );
  });

  it('returns null when the URL selects a type or users mode', () => {
    expect(
      resolveBareDiscoverRedirectHref(new URLSearchParams('type=book'), 'restaurant'),
    ).toBeNull();
    expect(
      resolveBareDiscoverRedirectHref(new URLSearchParams('users=1'), 'restaurant'),
    ).toBeNull();
  });
});
