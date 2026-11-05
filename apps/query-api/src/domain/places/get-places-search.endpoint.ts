import { Injectable } from '@nestjs/common';

import { ObjectIdentifiersRepository } from '../../repositories/object-identifiers.repository';
import { GeoipLookupService } from '../geoip/geoip-lookup.service';
import { toPlaceSearchItem } from './google-place.mapper';
import { GooglePlacesClient } from './google-places.client';
import { redisKey } from '../../constants/redis-keys';
import { PlacesBudgetService, sha256Hex } from './places-budget.service';
import {
  GOOGLE_MAPS_IDENTIFIER_TYPE,
  PLACES_CACHE_COORD_DECIMALS,
  PLACES_SEARCH_CACHE_TTL_SEC,
  PLACES_SEARCH_MIN_QUERY_LENGTH,
} from './places.constants';
import type { PlaceSearchItemDto, PlacesSearchResponseDto } from './places.types';

export type GetPlacesSearchInput = {
  q: string;
  limit: number;
  locale: string;
  clientIp: string | null;
};

type Bias = { latitude: number; longitude: number };

function biasSegment(bias: Bias | null): string {
  if (!bias) {
    return 'none';
  }
  return `${bias.latitude.toFixed(PLACES_CACHE_COORD_DECIMALS)}_${bias.longitude.toFixed(PLACES_CACHE_COORD_DECIMALS)}`;
}

/**
 * Google Maps places for a text query, biased to the caller's IP location.
 * Places already linked to an ODL object carry `existing_object_id` (dedup by
 * `identifier {type:'googleMaps'}`), recomputed on every call — never cached.
 */
@Injectable()
export class GetPlacesSearchEndpoint {
  constructor(
    private readonly google: GooglePlacesClient,
    private readonly geoip: GeoipLookupService,
    private readonly budget: PlacesBudgetService,
    private readonly identifiers: ObjectIdentifiersRepository,
  ) {}

  async execute(input: GetPlacesSearchInput): Promise<PlacesSearchResponseDto> {
    if (!this.google.isEnabled()) {
      return { enabled: false, places: [] };
    }
    const query = input.q.trim();
    if (query.length < PLACES_SEARCH_MIN_QUERY_LENGTH) {
      return { enabled: true, places: [] };
    }

    const bias = this.resolveBias(input.clientIp);
    const cacheKey = redisKey.placesSearch(
      sha256Hex(`${query.toLowerCase()}|${input.limit}`),
      input.locale,
      biasSegment(bias),
    );

    let items = await this.budget.readJson<PlaceSearchItemDto[]>(cacheKey);
    if (!items) {
      await this.budget.consumeGoogleCall(input.clientIp);
      const places = await this.google.searchText({
        query,
        languageCode: input.locale,
        limit: input.limit,
        bias,
      });
      if (!places) {
        return { enabled: true, places: [] };
      }
      items = places.map((place) => toPlaceSearchItem(place, null));
      await this.budget.writeJson(cacheKey, items, PLACES_SEARCH_CACHE_TTL_SEC);
    }

    const existing = await this.identifiers.findObjectIdsByIdentifier(
      GOOGLE_MAPS_IDENTIFIER_TYPE,
      items.map((item) => item.place_id),
    );
    return {
      enabled: true,
      places: items.map((item) => ({
        ...item,
        existing_object_id: existing.get(item.place_id) ?? null,
      })),
    };
  }

  private resolveBias(clientIp: string | null): Bias | null {
    if (!clientIp) {
      return null;
    }
    const geo = this.geoip.lookup(clientIp);
    if (geo?.latitude == null || geo.longitude == null) {
      return null;
    }
    return { latitude: geo.latitude, longitude: geo.longitude };
  }
}
