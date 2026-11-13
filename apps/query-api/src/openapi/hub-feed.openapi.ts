import { z } from 'zod';

import {
  hubActivityFeedBodyFieldsSchema,
  hubPostsFeedBodyFieldsSchema,
  hubThreadsFeedBodyFieldsSchema,
  hubUpdatesFeedBodyFieldsSchema,
} from '../domain/hub-feed/schemas/hub-feed.schema';
import {
  hubFeedFilterObjectsQuerySchema,
  hubFeedFiltersQuerySchema,
  hubFeedFilterUsersQuerySchema,
} from '../domain/hub-feed/schemas/hub-feed-filters.schema';
import { userBlogFeedResponseSchema } from './feed.openapi';
import { projectedObjectOpenApiSchema } from './projected-object.schema';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';
import {
  accountNameParam,
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

const COUNT_DESCRIPTION =
  'New items of the requested tab in the last 72 hours (scheduler buckets, refreshed every 5 minutes); `null` when counting exceeded its time budget.';

const hubFeedFilterUserSchema = registry.register(
  'HubFeedFilterUser',
  z.object({
    name: z.string(),
    avatarUrl: z.string().nullable(),
    count: z.number().int().nullable().openapi({ description: COUNT_DESCRIPTION }),
  }),
);

const hubFeedFilterObjectSchema = registry.register(
  'HubFeedFilterObject',
  z.object({
    objectId: z.string(),
    objectType: z.string(),
    count: z.number().int().nullable().openapi({ description: COUNT_DESCRIPTION }),
    object: projectedObjectOpenApiSchema.nullable().openapi({
      description: 'Light projection (name, avatar, parent).',
    }),
  }),
);

const hubFeedFilterUsersPageSchema = registry.register(
  'HubFeedFilterUsersPage',
  z.object({ items: z.array(hubFeedFilterUserSchema), hasMore: z.boolean() }),
);

const hubFeedFilterObjectsPageSchema = registry.register(
  'HubFeedFilterObjectsPage',
  z.object({ items: z.array(hubFeedFilterObjectSchema), hasMore: z.boolean() }),
);

const hubFeedFiltersSchema = registry.register(
  'HubFeedFilters',
  z.object({
    tab: z.enum(['posts', 'threads', 'activity', 'updates']),
    windowHours: z.number().int(),
    windowStart: z.number().int().openapi({ description: 'Unix seconds of the first hour counted.' }),
    countsAvailable: z.boolean(),
    users: hubFeedFilterUsersPageSchema.extend({ total: z.number().int() }),
    objectTypes: z.array(
      z.object({
        objectType: z.string(),
        count: z.number().int().nullable().openapi({ description: 'Sum of the type object counts.' }),
        total: z.number().int(),
        objects: hubFeedFilterObjectsPageSchema,
      }),
    ),
  }),
);

const userNotFoundSchema = z.object({
  statusCode: z.literal(404),
  message: z.string(),
  error: z.string(),
});

const filterRoutes = [
  {
    path: '/query/v1/users/{name}/feed-filters',
    summary: 'Hub rail: followed accounts and objects with new-item counts',
    description:
      'Followed accounts (by count, then expertise weight, then name) and followed active objects grouped by object type (objects by count, then weight; types by summed count). Returns the first `users_limit` / `objects_limit` rows of each section. Public: follows are public.',
    query: hubFeedFiltersQuerySchema,
    response: hubFeedFiltersSchema,
  },
  {
    path: '/query/v1/users/{name}/feed-filters/users',
    summary: 'Hub rail: next followed accounts ("show more")',
    description: 'Same order as the summary; `skip` = rows already shown.',
    query: hubFeedFilterUsersQuerySchema,
    response: hubFeedFilterUsersPageSchema,
  },
  {
    path: '/query/v1/users/{name}/feed-filters/objects',
    summary: 'Hub rail: next followed objects of one type ("show more")',
    description: 'Same order as the summary; `skip` = rows already shown.',
    query: hubFeedFilterObjectsQuerySchema,
    response: hubFeedFilterObjectsPageSchema,
  },
] as const;

for (const route of filterRoutes) {
  registry.registerPath({
    method: 'get',
    path: route.path,
    tags: [queryApiOpenApiTags.hubFeed],
    summary: route.summary,
    description: route.description,
    request: {
      params: z.object({ name: accountNameParam }),
      query: route.query,
      headers: hubFeedHeaders,
    },
    responses: {
      200: { description: 'Rail rows.', content: { 'application/json': { schema: route.response } } },
      404: {
        description: 'Account not in `accounts_current`.',
        content: { 'application/json': { schema: userNotFoundSchema } },
      },
    },
  });
}
