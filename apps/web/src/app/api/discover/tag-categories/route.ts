import type { NextRequest } from 'next/server';

import { proxyDiscoverTypeQuery } from '@/modules/discover/infrastructure/discover-type-query-proxy.server';

export async function GET(request: NextRequest) {
  return proxyDiscoverTypeQuery(request, 'tag-categories');
}
