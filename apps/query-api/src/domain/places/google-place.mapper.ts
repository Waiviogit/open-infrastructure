import type { GoogleAddressComponent, GooglePlace } from './google-places.schemas';
import {
  PLACE_GOOGLE_TYPES,
  RESTAURANT_GOOGLE_TYPES,
  type PlaceObjectType,
} from './places.constants';
import type { PlaceAddressDto, PlaceDetailsDto, PlaceSearchItemDto } from './places.types';

/** restaurant ⊃ place ⊃ business: the first matching group wins. */
export function suggestObjectTypeForGoogleTypes(
  types: readonly string[] | undefined,
): PlaceObjectType {
  const list = types ?? [];
  if (list.some((t) => RESTAURANT_GOOGLE_TYPES.has(t))) {
    return 'restaurant';
  }
  if (list.some((t) => PLACE_GOOGLE_TYPES.has(t))) {
    return 'place';
  }
  return 'business';
}

function componentText(
  components: readonly GoogleAddressComponent[],
  type: string,
): string | null {
  const match = components.find((c) => c.types.includes(type));
  const text = match?.longText?.trim() || match?.shortText?.trim();
  return text || null;
}

function firstComponentText(
  components: readonly GoogleAddressComponent[],
  types: readonly string[],
): string | null {
  for (const type of types) {
    const text = componentText(components, type);
    if (text) {
      return text;
    }
  }
  return null;
}

/**
 * Structured address from Google `addressComponents`. Fields stay `null` when Google
 * has no value; the client decides whether the result is complete enough to store.
 */
export function mapAddressComponents(
  components: readonly GoogleAddressComponent[] | undefined,
): PlaceAddressDto | null {
  if (!components || components.length === 0) {
    return null;
  }
  const route = componentText(components, 'route');
  const streetNumber = componentText(components, 'street_number');
  const street = [streetNumber, route].filter(Boolean).join(' ') || null;
  return {
    street,
    locality: firstComponentText(components, [
      'locality',
      'postal_town',
      'administrative_area_level_2',
      'sublocality',
    ]),
    state: componentText(components, 'administrative_area_level_1'),
    postal_code: componentText(components, 'postal_code'),
    country: componentText(components, 'country'),
  };
}

export function toPlaceSearchItem(
  place: GooglePlace,
  existingObjectId: string | null,
): PlaceSearchItemDto {
  return {
    place_id: place.id,
    name: place.displayName?.text?.trim() || place.formattedAddress?.trim() || place.id,
    formatted_address: place.formattedAddress?.trim() || null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    primary_type: place.primaryType ?? null,
    suggested_object_type: suggestObjectTypeForGoogleTypes(place.types),
    existing_object_id: existingObjectId,
  };
}

export function toPlaceDetails(
  place: GooglePlace,
  existingObjectId: string | null,
  photoUri: string | null,
): PlaceDetailsDto {
  return {
    ...toPlaceSearchItem(place, existingObjectId),
    address: mapAddressComponents(place.addressComponents),
    phone: place.internationalPhoneNumber?.trim() || null,
    website: place.websiteUri?.trim() || null,
    work_hours: (place.regularOpeningHours?.weekdayDescriptions ?? [])
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
    photo_uri: photoUri,
    maps_uri: place.googleMapsUri?.trim() || null,
  };
}

export function firstPhotoName(place: GooglePlace): string | null {
  return place.photos?.[0]?.name ?? null;
}
