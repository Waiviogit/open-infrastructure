/** Identifier `type` that links an ODL object to a Google Maps place (legacy `companyIdType: 'googleMaps'`). */
export const GOOGLE_MAPS_IDENTIFIER_TYPE = 'googleMaps';

/** Places API (New) `locationBias.circle.radius` upper bound; IP geolocation is city-level. */
export const PLACES_SEARCH_RADIUS_M = 50_000;

/** Shortest query that reaches Google (each request is billed). */
export const PLACES_SEARCH_MIN_QUERY_LENGTH = 3;

export const PLACES_SEARCH_MAX_QUERY_LENGTH = 100;

export const PLACES_SEARCH_DEFAULT_LIMIT = 5;

export const PLACES_SEARCH_MAX_LIMIT = 10;

/** Max Google place id length accepted from clients. */
export const PLACE_ID_MAX_LENGTH = 512;

/** Bias coordinates are rounded so nearby users share cache entries. */
export const PLACES_CACHE_COORD_DECIMALS = 1;

export const PLACES_SEARCH_CACHE_TTL_SEC = 600;

/** Short: the cached Google `photoUri` is a time-limited URL. */
export const PLACES_DETAILS_CACHE_TTL_SEC = 600;

/** Fixed-window budget guard: Google-backed requests per client IP per minute. */
export const PLACES_RATE_LIMIT_PER_MIN = 60;

export const PLACES_RATE_LIMIT_WINDOW_SEC = 60;

export const PLACES_PHOTO_MAX_WIDTH_PX = 1600;

/** Text Search field mask — Pro SKU fields only (no contact / atmosphere data). */
export const PLACES_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
].join(',');

/** Place Details field mask — requested once, when the user picks a place to create. */
export const PLACES_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'types',
  'primaryType',
  'internationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours.weekdayDescriptions',
  'photos',
  'googleMapsUri',
].join(',');

/** Google types that make a place an ODL `restaurant`. */
export const RESTAURANT_GOOGLE_TYPES: ReadonlySet<string> = new Set([
  'restaurant',
  'bar',
  'cafe',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'food',
  'coffee_shop',
  'pub',
  'wine_bar',
  'fast_food_restaurant',
  'pizza_restaurant',
  'sushi_restaurant',
  'steak_house',
  'seafood_restaurant',
  'brunch_restaurant',
  'breakfast_restaurant',
  'ice_cream_shop',
  'dessert_shop',
  'sandwich_shop',
  'bar_and_grill',
  'diner',
  'food_court',
]);

/** Google types that make a place an ODL `place` (landmarks, nature, culture). */
export const PLACE_GOOGLE_TYPES: ReadonlySet<string> = new Set([
  'tourist_attraction',
  'park',
  'national_park',
  'museum',
  'art_gallery',
  'church',
  'mosque',
  'synagogue',
  'hindu_temple',
  'place_of_worship',
  'zoo',
  'aquarium',
  'amusement_park',
  'campground',
  'beach',
  'hiking_area',
  'historical_landmark',
  'monument',
  'cultural_landmark',
  'natural_feature',
  'plaza',
  'city_hall',
  'library',
  'stadium',
  'botanical_garden',
  'marina',
  'locality',
  'neighborhood',
]);

export const PLACE_OBJECT_TYPES = ['restaurant', 'place', 'business'] as const;

export type PlaceObjectType = (typeof PLACE_OBJECT_TYPES)[number];
