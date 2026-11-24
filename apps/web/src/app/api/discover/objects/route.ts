import type { NextRequest } from 'next/server';

import { proxyDiscoverViewerQuery } from '@/modules/discover/infrastructure/discover-viewer-query-proxy.server';

export async function GET(request: NextRequest) {
  return proxyDiscoverViewerQuery(request, 'objects');
}
