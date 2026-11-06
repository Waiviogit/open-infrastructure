import type { NextRequest } from 'next/server';

import { proxyPlacesRequest } from '@/modules/editor/infrastructure/places-proxy.server';

/** BFF: ODL object already linked to a Google Maps place (dedup before create). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ 'place-id': string }> },
) {
  const { 'place-id': placeId } = await context.params;
  return proxyPlacesRequest(request, `/${encodeURIComponent(placeId)}/object`);
}
