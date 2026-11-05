import type { PlaceObjectType } from './places.constants';

export type PlaceAddressDto = {
  street: string | null;
  locality: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export type PlaceSearchItemDto = {
  place_id: string;
  name: string;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_type: string | null;
  suggested_object_type: PlaceObjectType;
  /** ODL object already linked to this place via `identifier {type:'googleMaps'}`. */
  existing_object_id: string | null;
};

export type PlacesSearchResponseDto = {
  /** `false` when Google Places is not configured on this deployment. */
  enabled: boolean;
  places: PlaceSearchItemDto[];
};

export type PlaceDetailsDto = PlaceSearchItemDto & {
  address: PlaceAddressDto | null;
  phone: string | null;
  website: string | null;
  work_hours: string[];
  /** Public Google photo URL (short-lived); upload it to IPFS before storing. */
  photo_uri: string | null;
  maps_uri: string | null;
};
