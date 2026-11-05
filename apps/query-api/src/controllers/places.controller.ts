import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';

import {
  GetObjectByIdentifierEndpoint,
  GetPlaceDetailsEndpoint,
  GetPlacesSearchEndpoint,
  GOOGLE_MAPS_IDENTIFIER_TYPE,
  placeDetailsParamsSchema,
  PlacesRateLimitedError,
  placesSearchQuerySchema,
  type PlaceDetailsDto,
  type PlacesSearchQuery,
  type PlacesSearchResponseDto,
} from '../domain/places';
import { ReqClientIp } from '../http/client-ip.decorator';
import { ReqLocale } from '../http/locale-header.decorator';
import { ZodQueryPipe } from '../pipes';

type PlaceParams = { place_id: string };

function rethrowRateLimit(error: unknown): never {
  if (error instanceof PlacesRateLimitedError) {
    throw new HttpException({ message: 'Too many place searches' }, HttpStatus.TOO_MANY_REQUESTS);
  }
  throw error;
}

/** Google Maps places near the caller (IP-biased) and their links to ODL objects. */
@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(
    private readonly placesSearch: GetPlacesSearchEndpoint,
    private readonly placeDetails: GetPlaceDetailsEndpoint,
    private readonly objectByIdentifier: GetObjectByIdentifierEndpoint,
  ) {}

  @Get('search')
  async search(
    @Query(new ZodQueryPipe(placesSearchQuerySchema)) query: PlacesSearchQuery,
    @ReqLocale() locale: string,
    @ReqClientIp() clientIp: string | null,
  ): Promise<PlacesSearchResponseDto> {
    try {
      return await this.placesSearch.execute({
        q: query.q,
        limit: query.limit,
        locale,
        clientIp,
      });
    } catch (error) {
      rethrowRateLimit(error);
    }
  }

  @Get(':place_id/object')
  async objectForPlace(
    @Param(new ZodQueryPipe(placeDetailsParamsSchema)) params: PlaceParams,
  ): Promise<{ object_id: string }> {
    const found = await this.objectByIdentifier.execute({
      type: GOOGLE_MAPS_IDENTIFIER_TYPE,
      value: params.place_id,
    });
    if (!found) {
      throw new NotFoundException('No object for this place');
    }
    return found;
  }

  @Get(':place_id')
  async details(
    @Param(new ZodQueryPipe(placeDetailsParamsSchema)) params: PlaceParams,
    @ReqLocale() locale: string,
    @ReqClientIp() clientIp: string | null,
  ): Promise<PlaceDetailsDto> {
    let details: PlaceDetailsDto | null;
    try {
      details = await this.placeDetails.execute({
        placeId: params.place_id,
        locale,
        clientIp,
      });
    } catch (error) {
      rethrowRateLimit(error);
    }
    if (!details) {
      throw new NotFoundException('Place not found');
    }
    return details;
  }
}
