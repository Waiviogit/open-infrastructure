import { businessRoutes, type BusinessNavId } from './routes';

/** Market sections in the hub tab band, in display order. */
export const BUSINESS_NAV_ITEMS: ReadonlyArray<{
  id: BusinessNavId;
  href: string;
  labelKey: string;
}> = [
  {
    id: 'discover',
    href: businessRoutes.discoverOffers,
    labelKey: 'business_nav_catalog',
  },
  {
    id: 'offers',
    href: businessRoutes.manageOffers,
    labelKey: 'business_nav_my_offers',
  },
  {
    id: 'requests',
    href: businessRoutes.manageRequests,
    labelKey: 'business_nav_my_requests',
  },
  {
    id: 'relationships',
    href: businessRoutes.relationships,
    labelKey: 'business_nav_relationships',
  },
  {
    id: 'arbitration',
    href: businessRoutes.arbitration,
    labelKey: 'business_nav_arbitration',
  },
  {
    id: 'dispute-resolution',
    href: businessRoutes.disputeResolution,
    labelKey: 'business_nav_dispute_resolution',
  },
];

/** Sections a signed-out visitor can open; every other section needs a session. */
const PUBLIC_NAV_IDS: ReadonlySet<BusinessNavId> = new Set(['discover']);

/** Band items for the viewer: guests only see the public catalog. */
export function businessNavItems(signedIn: boolean): typeof BUSINESS_NAV_ITEMS {
  return signedIn
    ? BUSINESS_NAV_ITEMS
    : BUSINESS_NAV_ITEMS.filter((item) => PUBLIC_NAV_IDS.has(item.id));
}

const PREFIXES: ReadonlyArray<[string, BusinessNavId]> = [
  ['/business/offers', 'discover'],
  ['/business/requests', 'discover'],
  ['/business/manage/requests', 'requests'],
  ['/business/manage/offers', 'offers'],
  ['/business/relationships', 'relationships'],
  ['/business/contracts', 'relationships'],
  ['/business/invoices', 'relationships'],
  ['/business/service-orders', 'relationships'],
  ['/business/reports', 'relationships'],
  ['/business/disputes', 'relationships'],
  ['/business/pay', 'relationships'],
  ['/business/arbitration', 'arbitration'],
  ['/business/dispute-resolution', 'dispute-resolution'],
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Market section of a `/business/*` path (null outside Market). `/business` itself is the catalog. */
export function businessNavIdForPath(pathname: string): BusinessNavId | null {
  if (pathname === '/business') {
    return 'discover';
  }
  return (
    PREFIXES.find(([prefix]) => matchesPrefix(pathname, prefix))?.[1] ?? null
  );
}

export function isBusinessPath(pathname: string): boolean {
  return matchesPrefix(pathname, '/business');
}
