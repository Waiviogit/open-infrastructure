import { resolveSignedInRouteRedirect } from './signed-in-routes';

describe('resolveSignedInRouteRedirect', () => {
  it.each([
    ['/business/manage/offers/drafts', '/sign-in'],
    ['/business/contracts/c-1', '/sign-in'],
    ['/business/relationships', '/sign-in'],
    ['/object-create', '/sign-in'],
    ['/editor', '/'],
    ['/drafts', '/'],
    ['/notifications/settings', '/'],
  ])('sends anonymous %s to %s', (pathname, target) => {
    expect(resolveSignedInRouteRedirect(pathname)).toBe(target);
  });

  it.each(['/', '/business/offers', '/business/requests', '/offers/o-1/versions/1', '/settings', '/draftsx'])(
    'leaves public %s alone',
    (pathname) => {
      expect(resolveSignedInRouteRedirect(pathname)).toBeNull();
    },
  );
});
