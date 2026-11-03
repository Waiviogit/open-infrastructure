/**
 * Client-side pathname for the object detail route.
 * Must stay aligned with `@opden-data-layer/site-canonical` `buildFallbackCanonicalUrl`
 * (`/object/${encodeURIComponent(objectId)}`).
 */
export function objectPagePath(objectId: string): string {
  return `/object/${encodeURIComponent(objectId)}`;
}

/** True when the browser is showing a full-page object detail route (`/object/…`). */
export function isFullPageObjectPath(pathname: string | null | undefined): boolean {
  if (pathname == null || pathname === '') {
    return false;
  }
  return pathname === '/object' || pathname.startsWith('/object/');
}

/**
 * True when `pathname` belongs to the given object's page (`/object/:id` or any sub-route).
 * False for intercepted overlays (e.g. post modal at `/@account/permlink`) rendered over the object.
 */
export function isPathnameWithinObjectPage(
  objectId: string,
  pathname: string | null | undefined,
): boolean {
  if (pathname == null || pathname === '') {
    return false;
  }
  const base = objectPagePath(objectId);
  return pathname === base || pathname.startsWith(`${base}/`);
}
