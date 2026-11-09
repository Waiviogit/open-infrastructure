const SIGN_IN_PATH = '/sign-in';
const HOME_PATH = '/';

type SignedInRoute = {
  prefix: string;
  /** Where an anonymous visitor goes — the same target as the page's own fallback check. */
  redirectTo: string;
};

/**
 * Routes that need a session. `proxy.ts` redirects an anonymous request (no access cookie after
 * the silent refresh) before rendering, so the 307 is real: pages stream their user read behind
 * `<Suspense>`, where `redirect()` can only arrive as a client redirect. Pages keep their own check
 * for tokens that are present but invalid.
 */
const SIGNED_IN_ROUTES: readonly SignedInRoute[] = [
  { prefix: '/business/manage', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/relationships', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/arbitration', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/dispute-resolution', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/pay', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/contracts', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/invoices', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/disputes', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/reports', redirectTo: SIGN_IN_PATH },
  { prefix: '/business/service-orders', redirectTo: SIGN_IN_PATH },
  { prefix: '/object-create', redirectTo: SIGN_IN_PATH },
  { prefix: '/editor', redirectTo: HOME_PATH },
  { prefix: '/drafts', redirectTo: HOME_PATH },
  { prefix: '/notifications', redirectTo: HOME_PATH },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Redirect target for an anonymous request to a signed-in route; `null` when the route is public. */
export function resolveSignedInRouteRedirect(pathname: string): string | null {
  return (
    SIGNED_IN_ROUTES.find((route) => matchesPrefix(pathname, route.prefix))?.redirectTo ?? null
  );
}
