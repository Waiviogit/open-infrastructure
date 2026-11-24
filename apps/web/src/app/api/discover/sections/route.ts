import type { NextRequest } from 'next/server';

import { proxyDiscoverViewerQuery } from '@/modules/discover/infrastructure/discover-viewer-query-proxy.server';

/** Category blocks of a Discover category (center column below the type root). */
export async function GET(request: NextRequest) {
  return proxyDiscoverViewerQuery(request, 'sections');
}
