export function objectCanonical(origin: string, objectId: string): string {
  return new URL(`/object/${encodeURIComponent(objectId)}`, origin).toString();
}

export function postCanonical(origin: string, permalinkPath: string): string {
  const path = permalinkPath.startsWith('/') ? permalinkPath : `/${permalinkPath}`;
  return new URL(path, origin).toString();
}

export function profileCanonical(origin: string, account: string): string {
  return new URL(`/@${encodeURIComponent(account)}`, origin).toString();
}

export function homeCanonical(origin: string): string {
  return new URL('/', origin).toString();
}

export function discoverCanonical(origin: string): string {
  return new URL('/discover', origin).toString();
}

export function signInCanonical(origin: string): string {
  return new URL('/sign-in', origin).toString();
}

/** Public OBL offer / request version page (`/offers/:id/versions/:v`, `/requests/...`). */
export function offerCanonical(
  origin: string,
  kind: 'offer' | 'request',
  offerId: string,
  version: number,
): string {
  const section = kind === 'request' ? 'requests' : 'offers';
  return new URL(
    `/${section}/${encodeURIComponent(offerId)}/versions/${version}`,
    origin,
  ).toString();
}
