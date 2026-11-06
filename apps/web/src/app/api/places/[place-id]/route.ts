import type { NextRequest } from 'next/server';

import { proxyPlacesRequest } from '@/modules/editor/infrastructure/places-proxy.server';

/** BFF: one Google Maps place with full details (signed-in users only). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ 'place-id': string }> },
) {
  const { 'place-id': placeId } = await context.params;
  return proxyPlacesRequest(request, `/${encodeURIComponent(placeId)}`);
}
