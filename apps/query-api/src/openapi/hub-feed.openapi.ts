import { z } from 'zod';

import {
  hubActivityFeedBodyFieldsSchema,
  hubPostsFeedBodyFieldsSchema,
  hubThreadsFeedBodyFieldsSchema,
  hubUpdatesFeedBodyFieldsSchema,
} from '../domain/hub-feed/schemas/hub-feed.schema';
import { userBlogFeedResponseSchema } from './feed.openapi';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';
import {
  followedObjectUpdateFeedItemSchema,
  followedObjectsMessagesResponseSchema,
} from './users-social.openapi';

const FILTER_DESCRIPTION =
  'Exactly one rail filter: `trending` / `hot` (created in the last 3 days, by votes / comments), `new`, `my` (needs `X-Viewer`), `author`, `object`. Unsupported sorts for the tab are rejected with 400.';

const hubFeedHeaders = z.object({
  'accept-language': z.string().optional(),
  'x-locale': z.string().optional(),
  'x-governance-object-id': z.string().optional(),
  'x-viewer': z.string().optional().openapi({
    description:
      'Viewer account: required for `my`; applies viewer mutes and fills viewer vote state.',
    example: 'alice',
  }),
});

const badRequestSchema = z.object({
  statusCode: z.literal(400),
  message: z.unknown(),
  error: z.string().optional(),
});

const hubUpdatesFeedResponseSchema = registry.register(
  'HubUpdatesFeedResponse',
  z.object({
    items: z.array(followedObjectUpdateFeedItemSchema),
    cursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
);

const routes = [
  {
    tab: 'posts',
    summary: 'Hub Posts tab',
    description: `Root posts. ${FILTER_DESCRIPTION}`,
    body: registry.register('HubPostsFeedBody', hubPostsFeedBodyFieldsSchema),
    response: userBlogFeedResponseSchema,
  },
  {
    tab: 'threads',
    summary: 'Hub Threads tab',
    description: `Threads; \`objects\` lists active objects named in the hashtags (max 4). ${FILTER_DESCRIPTION}`,
    body: registry.register('HubThreadsFeedBody', hubThreadsFeedBodyFieldsSchema),
    response: userBlogFeedResponseSchema,
  },
  {
    tab: 'activity',
    summary: 'Hub Activity tab',
    description:
      'Canonical messages of object channels, newest first by `COALESCE(original_created_at_unix, created_at_unix)`. Filters: `new`, `my`, `author`, `object` (no ranked sorts).',
    body: registry.register('HubActivityFeedBody', hubActivityFeedBodyFieldsSchema),
    response: followedObjectsMessagesResponseSchema,
  },
  {
    tab: 'updates',
    summary: 'Hub Updates tab',
    description: `Object updates of active objects with approval and vote fields plus the updated \`object\`. \`trending\` orders by \`rank_score\`; no \`hot\`. ${FILTER_DESCRIPTION}`,
    body: registry.register('HubUpdatesFeedBody', hubUpdatesFeedBodyFieldsSchema),
    response: hubUpdatesFeedResponseSchema,
  },
] as const;

for (const route of routes) {
  registry.registerPath({
    method: 'post',
    path: `/query/v1/feed/${route.tab}`,
    tags: [queryApiOpenApiTags.hubFeed],
    summary: route.summary,
    description: route.description,
    request: {
      body: { content: { 'application/json': { schema: route.body } }, required: false },
      headers: hubFeedHeaders,
    },
    responses: {
      200: {
        description: 'Keyset page; the cursor only continues the same filter.',
        content: { 'application/json': { schema: route.response } },
      },
      400: {
        description: 'Invalid body, unsupported sort for the tab, or `my` without `X-Viewer`.',
        content: { 'application/json': { schema: badRequestSchema } },
      },
    },
  });
}
