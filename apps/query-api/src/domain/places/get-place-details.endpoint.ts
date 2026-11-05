import { Injectable } from '@nestjs/common';

import { redisKey } from '../../constants/redis-keys';
import { ObjectIdentifiersRepository } from '../../repositories/object-identifiers.repository';
import { firstPhotoName, toPlaceDetails } from './google-place.mapper';
import { GooglePlacesClient } from './google-places.client';
import { PlacesBudgetService } from './places-budget.service';
import { GOOGLE_MAPS_IDENTIFIER_TYPE, PLACES_DETAILS_CACHE_TTL_SEC } from './places.constants';
import type { PlaceDetailsDto } from './places.types';

export type GetPlaceDetailsInput = {
  placeId: string;
  locale: string;
  clientIp: string | null;
};

/**
 * Full data of one Google place (address parts, contacts, hours, photo URL) used
 * to prefill a user-created object. `null` = unknown place or Google unavailable.
 */
@Injectable()
export class GetPlaceDetailsEndpoint {
  constructor(
    private readonly google: GooglePlacesClient,
    private readonly budget: PlacesBudgetService,
    private readonly identifiers: ObjectIdentifiersRepository,
  ) {}

  async execute(input: GetPlaceDetailsInput): Promise<PlaceDetailsDto | null> {
    const existing = await this.identifiers.findObjectIdsByIdentifier(
      GOOGLE_MAPS_IDENTIFIER_TYPE,
      [input.placeId],
    );
    const existingObjectId = existing.get(input.placeId) ?? null;

    const cacheKey = redisKey.placeDetails(input.placeId, input.locale);
    const cached = await this.budget.readJson<PlaceDetailsDto>(cacheKey);
    if (cached) {
      return { ...cached, existing_object_id: existingObjectId };
    }
    if (!this.google.isEnabled()) {
      return null;
    }

    await this.budget.consumeGoogleCall(input.clientIp);
    const result = await this.google.getDetails(input.placeId, input.locale);
    if (result.status !== 'found') {
      return null;
    }
    const photoName = firstPhotoName(result.place);
    const photoUri = photoName ? await this.google.getPhotoUri(photoName) : null;
    const details = toPlaceDetails(result.place, null, photoUri);
    await this.budget.writeJson(cacheKey, details, PLACES_DETAILS_CACHE_TTL_SEC);
    return { ...details, existing_object_id: existingObjectId };
  }
}
