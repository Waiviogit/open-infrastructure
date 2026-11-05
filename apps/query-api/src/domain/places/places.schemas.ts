import { z } from 'zod';

import {
  PLACE_ID_MAX_LENGTH,
  PLACES_SEARCH_DEFAULT_LIMIT,
  PLACES_SEARCH_MAX_LIMIT,
  PLACES_SEARCH_MAX_QUERY_LENGTH,
} from './places.constants';

/** Google place ids are URL-safe base64-like tokens. */
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const placesSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(PLACES_SEARCH_MAX_QUERY_LENGTH).describe('Place name or text query'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PLACES_SEARCH_MAX_LIMIT)
    .optional()
    .default(PLACES_SEARCH_DEFAULT_LIMIT)
    .describe('Max Google places to return'),
});

export type PlacesSearchQuery = z.infer<typeof placesSearchQuerySchema>;

export const placeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLACE_ID_MAX_LENGTH)
  .regex(PLACE_ID_PATTERN)
  .describe('Google Maps place id');

export const placeDetailsParamsSchema = z.object({
  place_id: placeIdSchema,
});
