import { z } from 'zod';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const searchObjectResultSchema = registry.register(
  'SearchObjectResult',
  z.object({
    object_id: z.string(),
    object_type: z.string(),
    name: z.string().nullable(),
    image_url: z.string().nullable(),
    parent_name: z.string().nullable(),
  }),
);

const searchUserResultSchema = registry.register(
  'SearchUserResult',
  z.object({
    name: z.string(),
    profile_image: z.string().nullable().openapi({
      description:
        'Profile avatar from `posting_json_metadata.profile.profile_image`, falling back to `json_metadata.profile.profile_image`, then `accounts_current.profile_image`.',
    }),
    reputation: z.number(),
    wobjects_weight: z.number(),
    followers_count: z.number().int(),
    is_following: z.boolean(),
  }),
);

const searchResponseDtoSchema = registry.register(
  'SearchResponseDto',
  z.object({
    objects: z.array(searchObjectResultSchema),
    users: z.array(searchUserResultSchema),
  }),
);

const searchCountsResponseDtoSchema = registry.register(
  'SearchCountsResponseDto',
  z.object({
    type_counts: z.record(z.string(), z.number().int()).openapi({
      description:
        'Active objects per `object_type` matching query `q`, counted in product groups (one per `meta_group_id`). Lower bounds when `counts_capped` is true.',
    }),
    counts_capped: z.boolean().openapi({
      description:
        'True when more objects match than the server counts (100,000): `type_counts` are then lower bounds — show them as `N+`. `total_users` is never capped.',
    }),
    total_users: z.number().int().openapi({
      description: 'Total users matching the name prefix for query `q` (exact, never capped).',
    }),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/search',
  tags: [queryApiOpenApiTags.search],
  summary: 'Predictive search (objects + users)',
  description:
    'Objects come from the search read model (one document per active object, kept current by the indexer). The query is normalized (lower case, punctuation as word breaks, apostrophes inside a word dropped, no stemming, no accent folding) and every word must be a word prefix of the winning names, titles, identifiers, address locality, object id words or descriptions; a one-letter word is ignored while it is the last one, and a query without a word of 2+ letters (one CJK character counts) returns no objects. One hit per product group (`meta_group_id`). Order: exact `object_id`, exact name, name starts with the query, then `weight`. Hits are projected via `ObjectProjectionService` (`name`, `image`, `parent`) over active objects only. Users: prefix btree range on `accounts_current.name`, exact name match first, then Waiv object weight and followers (max 5). Optional `X-Viewer` sets `is_following` via `user_subscriptions`. Respects `X-Governance-Object-Id` and locale like other read endpoints. Tab counts: use `GET /search/counts`.',
  request: {
    query: z.object({
      q: z.string().min(1).max(100).openapi({ description: 'Search text.' }),
      limit: z.coerce.number().int().min(1).max(20).default(10).openapi({
        description: 'Max object hits (users capped internally at 5).',
      }),
      type: z.enum(['all', 'objects', 'users']).default('all').openapi({
        description:
          'Restrict results: `objects` skips user search; `users` skips object search and projection.',
      }),
    }),
    headers: z.object({
      'x-viewer': z.string().optional().openapi({
        description: 'Optional Hive account for follow status on user rows and projection context.',
      }),
      'x-governance-object-id': z.string().optional().openapi({
        description: 'Optional governance merge (same as object resolve).',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Object and user hits for the current page (no global tab counts).',
      content: {
        'application/json': {
          schema: searchResponseDtoSchema,
        },
      },
    },
  },
});

const searchObjectsByIdsResponseSchema = registry.register(
  'SearchObjectsByIdsResponseDto',
  z.object({
    objects: z.array(searchObjectResultSchema),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/query/v1/search/objects-by-ids',
  tags: [queryApiOpenApiTags.search],
  summary: 'Resolve object card display by ids',
  description:
    'Loads active objects by primary key (`object_id`) via `AggregatedObjectRepository.loadByObjectIds`, then projects `name`, `image`, and `parent` like `GET /search`. No text match or `meta_group_id` dedup. Missing or inactive ids are omitted. Used by the post editor to hydrate linked objects after draft reload.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            object_ids: z
              .array(z.string().min(1))
              .min(1)
              .max(100)
              .openapi({ description: 'Hive object ids (max 100).' }),
          }),
        },
      },
    },
    headers: z.object({
      'x-viewer': z.string().optional().openapi({
        description: 'Optional Hive account for projection context.',
      }),
      'x-governance-object-id': z.string().optional().openapi({
        description: 'Optional governance merge (same as object resolve).',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Projected object rows for the requested ids (subset when some ids are missing).',
      content: {
        'application/json': {
          schema: searchObjectsByIdsResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/search/counts',
  tags: [queryApiOpenApiTags.search],
  summary: 'Predictive search global counts',
  description:
    'Returns `type_counts` (active objects per `object_type`, counted in product groups) and `total_users` for query `q`. Objects match by the same word-prefix rules as `GET /search`. Object counts stop at a cap: when more objects match, `counts_capped` is true and every `type_counts` value is a lower bound. A just-deactivated object can be counted until the indexer removes its document (one worker tick). Intended for header tab badges loaded after the main search response.',
  request: {
    query: z.object({
      q: z.string().min(1).max(100).openapi({ description: 'Search text.' }),
    }),
  },
  responses: {
    200: {
      description: 'Global counts for tab badges.',
      content: {
        'application/json': {
          schema: searchCountsResponseDtoSchema,
        },
      },
    },
  },
});
