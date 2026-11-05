import { z } from 'zod';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const placeObjectTypeSchema = z.enum(['restaurant', 'place', 'business']);

const placeSearchItemSchema = registry.register(
  'PlaceSearchItem',
  z.object({
    place_id: z.string().openapi({ description: 'Google Maps place id.' }),
    name: z.string(),
    formatted_address: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    primary_type: z.string().nullable().openapi({ description: 'Google primary type.' }),
    suggested_object_type: placeObjectTypeSchema.openapi({
      description: 'ODL object type derived from Google types: restaurant, then place, else business.',
    }),
    existing_object_id: z.string().nullable().openapi({
      description: 'ODL object already linked via `identifier {type:"googleMaps", value: place_id}`.',
    }),
  }),
);

const placesSearchResponseSchema = registry.register(
  'PlacesSearchResponse',
  z.object({
    enabled: z.boolean().openapi({
      description: '`false` when `GOOGLE_PLACES_API_KEY` is not configured; `places` is then empty.',
    }),
    places: z.array(placeSearchItemSchema),
  }),
);

const placeDetailsSchema = registry.register(
  'PlaceDetails',
  placeSearchItemSchema.extend({
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
    work_hours: z.array(z.string()).openapi({ description: 'One line per weekday.' }),
    photo_uri: z.string().nullable().openapi({
      description: 'Short-lived public Google photo URL; upload to IPFS before storing.',
    }),
    maps_uri: z.string().nullable(),
  }),
);

const placeIdParams = z.object({
  place_id: z.string().min(1).max(512).openapi({ description: 'Google Maps place id.' }),
});

const tooManyRequests = {
  description: 'Per-IP Google budget exceeded (fixed one-minute window).',
};

registry.registerPath({
  method: 'get',
  path: '/query/v1/places/search',
  tags: [queryApiOpenApiTags.places],
  summary: 'Google Maps places near the caller',
  description:
    'Places API (New) text search biased (50 km circle) to the client IP location from GeoLite2-City; no bias when the IP has no coordinates. Queries shorter than 3 characters return no places. Responses are cached in Redis per query, language and rounded location; `existing_object_id` is recomputed on every call.',
  request: {
    query: z.object({
      q: z.string().min(1).max(100).openapi({ description: 'Text query.' }),
      limit: z.coerce.number().int().min(1).max(10).default(5),
    }),
  },
  responses: {
    200: {
      description: 'Places in Google relevance order.',
      content: { 'application/json': { schema: placesSearchResponseSchema } },
    },
    429: tooManyRequests,
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/places/{place_id}',
  tags: [queryApiOpenApiTags.places],
  summary: 'Google Maps place details',
  description:
    'Address components, phone, website, opening hours and first photo URL of one place, used to prefill an object the user creates. Cached in Redis for 10 minutes.',
  request: { params: placeIdParams },
  responses: {
    200: {
      description: 'Place details.',
      content: { 'application/json': { schema: placeDetailsSchema } },
    },
    404: { description: 'Unknown place or Google Places unavailable.' },
    429: tooManyRequests,
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/places/{place_id}/object',
  tags: [queryApiOpenApiTags.places],
  summary: 'Object linked to a Google Maps place',
  description: 'Exact lookup by `identifier {type:"googleMaps", value: place_id}`. Does not call Google.',
  request: { params: placeIdParams },
  responses: {
    200: {
      description: 'Linked object id.',
      content: { 'application/json': { schema: z.object({ object_id: z.string() }) } },
    },
    404: { description: 'No object links this place.' },
  },
});
