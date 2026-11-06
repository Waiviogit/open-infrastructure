import type { NextRequest } from 'next/server';

import { proxyPlacesRequest } from '@/modules/editor/infrastructure/places-proxy.server';

/** BFF: Google Maps places near the caller (signed-in users only). */
export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const key of ['q', 'limit']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value != null) {
      params.set(key, value);
    }
  }
  return proxyPlacesRequest(request, '/search', params);
}
