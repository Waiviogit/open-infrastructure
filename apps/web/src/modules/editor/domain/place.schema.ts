import { z } from 'zod';

/** Object types a Google Maps place can be created as (see query-api `places.constants`). */
export const PLACE_OBJECT_TYPES = ['restaurant', 'place', 'business'] as const;

export type PlaceObjectType = (typeof PLACE_OBJECT_TYPES)[number];

/** Identifier `type` linking an ODL object to a Google Maps place id. */
export const GOOGLE_MAPS_IDENTIFIER_TYPE = 'googleMaps';

export const placeSearchItemSchema = z.object({
  place_id: z.string().min(1),
  name: z.string(),
  formatted_address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  primary_type: z.string().nullable(),
  suggested_object_type: z.enum(PLACE_OBJECT_TYPES),
  existing_object_id: z.string().nullable(),
});

export const placesSearchResponseSchema = z.object({
  enabled: z.boolean(),
  places: z.array(placeSearchItemSchema),
});

export const placeDetailsSchema = placeSearchItemSchema.extend({
  address: z
    .object({
      street: z.string().nullable(),
      locality: z.string().nullable(),
      state: z.string().nullable(),
      postal_code: z.string().nullable(),
      country: z.string().nullable(),
    })
    .nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  work_hours: z.array(z.string()),
  photo_uri: z.string().nullable(),
  maps_uri: z.string().nullable(),
});

export const placeObjectResponseSchema = z.object({ object_id: z.string().min(1) });

export type PlaceSearchItem = z.infer<typeof placeSearchItemSchema>;
export type PlacesSearchResponse = z.infer<typeof placesSearchResponseSchema>;
export type PlaceDetails = z.infer<typeof placeDetailsSchema>;
