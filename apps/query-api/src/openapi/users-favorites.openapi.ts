import { z } from 'zod';

import { userFavoritesMapBodySchema } from '../domain/favorites/post-user-favorites-map.schema';
import { projectedObjectOpenApiSchema } from './projected-object.schema';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';
import { accountNameParam, paginatedProjectedObjectsSchema } from './users-social.openapi';

const favoritesLocaleHeader = z.string().optional().openapi({
  description: 'Preferred locale (first BCP-47 tag is used).',
});

const favoritesViewerHeader = z.string().optional().openapi({
  description:
    'Hive account name of the authenticated viewer. Populates per-object viewer fields on projected objects.',
});

const userFavoritesTypeItemSchema = registry.register(
  'UserFavoritesTypeItem',
  z.object({
    object_type: z.string(),
    objects_count: z.number().int().positive(),
    supports_categories: z.boolean().openapi({
      description: 'True when the type supports the `category` update.',
    }),
    has_categories: z.boolean().openapi({
      description:
        'True when `supports_categories` and the category root (`GET /query/v1/users/:name/categories?types=<type>`) lists at least one category. Clients show category navigation only then; otherwise a flat list.',
    }),
  }),
);

const userFavoritesTypesResponseSchema = registry.register(
  'UserFavoritesTypesResponse',
  z.object({
    types: z.array(z.string()).openapi({
      description: 'Object types in the Favorites scope, count DESC then type ASC.',
    }),
    items: z.array(userFavoritesTypeItemSchema).openapi({
      description: 'Same order as `types`, with live counts and category support.',
    }),
  }),
);

const userFavoritesMapResponseSchema = registry.register(
  'UserFavoritesMapResponse',
  z.object({
    items: z.array(projectedObjectOpenApiSchema),
    hasMore: z.boolean(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/favorites/types',
  tags: [queryApiOpenApiTags.users],
  summary: 'List object types in user favorites',
  description:
    'Object types in the unified Favorites scope (`object_favorite` ∪ authored `post_objects` − `user_shop_deselect`, per-type hide flags, `USER_FAVORITES_OBJECT_TYPES`; no ownership), sorted by count DESC then type ASC. `items` adds `objects_count`, `supports_categories` and `has_categories`. Returns `{ types: [], items: [] }` for unknown or blank account names (no 404).',
  request: {
    params: z.object({ name: accountNameParam }),
    headers: z.object({
      'accept-language': favoritesLocaleHeader,
      'x-locale': favoritesLocaleHeader,
      'x-viewer': favoritesViewerHeader,
    }),
  },
  responses: {
    200: {
      description: 'Type list for sidebar navigation.',
      content: { 'application/json': { schema: userFavoritesTypesResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/favorites',
  tags: [queryApiOpenApiTags.users],
  summary: 'List user favorite objects',
  description:
    'Paginated objects from the unified Favorites scope (`object_favorite` ∪ authored `post_objects` − `user_shop_deselect`, per-type hide flags, `USER_FAVORITES_OBJECT_TYPES`; no ownership), ordered by `weight DESC NULLS LAST, object_id ASC`. Unknown account names or types outside the whitelist return an empty page (`items: []`, `total: 0`) rather than 404. Blank `name` returns `null` body.',
  request: {
    params: z.object({ name: accountNameParam }),
    headers: z.object({
      'accept-language': favoritesLocaleHeader,
      'x-locale': favoritesLocaleHeader,
      'x-viewer': favoritesViewerHeader,
    }),
    query: z.object({
      objectType: z.string().min(1).optional().openapi({
        description: 'Filter to one object type; types outside USER_FAVORITES_OBJECT_TYPES return an empty page.',
      }),
      skip: z.coerce.number().int().min(0).optional().openapi({ description: 'Pagination offset.' }),
      limit: z.coerce
        .number()
        .int()
        .min(0)
        .max(50)
        .optional()
        .openapi({ description: 'Page size.' }),
      country: z.string().trim().max(32).optional().openapi({
        description: 'ISO 3166-1 alpha-2 or affiliate geo token; overrides GeoIP when valid.',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated projected objects.',
      content: { 'application/json': { schema: paginatedProjectedObjectsSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/query/v1/users/{name}/favorites/map',
  tags: [queryApiOpenApiTags.users],
  summary: 'Geo-filtered user favorites for profile map',
  description:
    'Unified Favorites scope intersected with `MAP_GEO_OBJECT_TYPES` and objects whose latest `geo` update falls inside `box`. Returns projected objects with `fields.geo` when available. Unknown users get `{ items: [], hasMore: false }`.',
  request: {
    params: z.object({ name: accountNameParam }),
    headers: z.object({
      'accept-language': favoritesLocaleHeader,
      'x-locale': favoritesLocaleHeader,
      'x-viewer': favoritesViewerHeader,
    }),
    body: {
      content: {
        'application/json': {
          schema: userFavoritesMapBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Map markers or sidebar list page.',
      content: { 'application/json': { schema: userFavoritesMapResponseSchema } },
    },
  },
});

export { userFavoritesTypesResponseSchema, userFavoritesMapResponseSchema };
