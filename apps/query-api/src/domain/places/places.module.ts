import { Module } from '@nestjs/common';

import { RepositoriesModule } from '../../repositories';
import { GeoipModule } from '../geoip';
import { GetObjectByIdentifierEndpoint } from './get-object-by-identifier.endpoint';
import { GetPlaceDetailsEndpoint } from './get-place-details.endpoint';
import { GetPlacesSearchEndpoint } from './get-places-search.endpoint';
import { GooglePlacesClient } from './google-places.client';
import { PlacesBudgetService } from './places-budget.service';

@Module({
  imports: [RepositoriesModule, GeoipModule],
  providers: [
    GooglePlacesClient,
    PlacesBudgetService,
    GetPlacesSearchEndpoint,
    GetPlaceDetailsEndpoint,
    GetObjectByIdentifierEndpoint,
  ],
  exports: [GetPlacesSearchEndpoint, GetPlaceDetailsEndpoint, GetObjectByIdentifierEndpoint],
})
export class PlacesModule {}
