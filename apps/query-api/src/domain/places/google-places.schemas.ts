import { z } from 'zod';

const localizedTextSchema = z
  .object({ text: z.string().optional() })
  .partial()
  .optional();

const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const addressComponentSchema = z.object({
  longText: z.string().optional(),
  shortText: z.string().optional(),
  types: z.array(z.string()).optional().default([]),
});

const photoSchema = z.object({
  name: z.string().min(1),
});

/** One place from Places API (New); unknown keys are ignored, `id` is mandatory. */
export const googlePlaceSchema = z.object({
  id: z.string().min(1),
  displayName: localizedTextSchema,
  formattedAddress: z.string().optional(),
  addressComponents: z.array(addressComponentSchema).optional(),
  location: latLngSchema.optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  regularOpeningHours: z
    .object({ weekdayDescriptions: z.array(z.string()).optional() })
    .optional(),
  photos: z.array(photoSchema).optional(),
  googleMapsUri: z.string().optional(),
});

export type GooglePlace = z.infer<typeof googlePlaceSchema>;

export type GoogleAddressComponent = z.infer<typeof addressComponentSchema>;

export const googleSearchTextResponseSchema = z.object({
  places: z.array(z.unknown()).optional().default([]),
});

export const googlePhotoMediaResponseSchema = z.object({
  photoUri: z.string().url(),
});
