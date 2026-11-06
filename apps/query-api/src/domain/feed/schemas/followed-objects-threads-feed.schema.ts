import { z } from 'zod';

export const followedObjectsThreadsFeedBodyFieldsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Page size'),
  cursor: z.string().optional().describe('Opaque pagination cursor from the previous page'),
});

export const followedObjectsThreadsFeedBodySchema = z.preprocess(
  (data) => (data === undefined || data === null ? {} : data),
  followedObjectsThreadsFeedBodyFieldsSchema,
);

export type FollowedObjectsThreadsFeedBody = z.infer<typeof followedObjectsThreadsFeedBodySchema>;
