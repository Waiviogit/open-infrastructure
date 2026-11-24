import type { NextRequest } from 'next/server';

import { proxyDiscoverTypeQuery } from '@/modules/discover/infrastructure/discover-type-query-proxy.server';

/** One level of an object type's category tree (Discover left rail). */
export async function GET(request: NextRequest) {
  return proxyDiscoverTypeQuery(request, 'categories');
}
