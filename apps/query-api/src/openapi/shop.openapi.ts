import { z } from 'zod';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const shopTagCategoryItemSchema = registry.register(
  'UserShopTagCategoryItemDto',
  z.object({
    value: z.string(),
    count: z.number().int(),
  }),
);

const shopTagCategorySectionSchema = registry.register(
  'UserShopTagCategorySectionDto',
  z.object({
    category: z.string(),
    items: z.array(shopTagCategoryItemSchema),
  }),
);

const badRequestSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
  issues: z.unknown().optional(),
});

const badRequestResponse = {
  description:
    'Query validation failed (Zod): missing or non-Favorites `types`, invalid cursor or rating.',
  content: { 'application/json': { schema: badRequestSchema } },
};

const userShopFiltersResponseSchema = registry.register(
  'UserShopFiltersResponseDto',
  z.object({
    ratings: z.array(z.number().int()).openapi({
      description: 'Static rating thresholds (legacy 10-point scale: 10, 8, 6).',
    }),
    categories: z.array(shopTagCategorySectionSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/shop-objects',
  tags: [queryApiOpenApiTags.users],
  summary: 'Flat Favorites object list for a user',
  description:
    'Projected cards from the unified Favorites scope (see users-favorites spec), optionally under `categoryPath` or uncategorized, narrowed by `tags`/`rating`. Ordered by `weight DESC NULLS LAST, object_id ASC` with an opaque keyset `cursor` (invalid cursor → 400). Optional `country` overrides GeoIP for affiliate links. Cards may include `fields.identifier` and `affiliateLinks`.',
  request: {
    params: z.object({
      name: z.string().min(1).openapi({ param: { name: 'name', in: 'path', required: true } }),
    }),
    query: z.object({
      types: z.union([z.string(), z.array(z.string())]).openapi({
        description: 'Repeatable, required. Every entry must be in `USER_FAVORITES_OBJECT_TYPES`, otherwise 400.',
      }),
      categoryPath: z.union([z.string(), z.array(z.string())]).optional().openapi({
        description: 'AND filter on category_names path segments.',
      }),
      uncategorizedOnly: z.union([z.boolean(), z.string()]).optional().openapi({
        description: 'When true, only objects with no category_names.',
      }),
      tags: z.union([z.string(), z.array(z.string())]).optional().openapi({
        description: 'Tag filters as category:value, combined with AND.',
      }),
      rating: z.coerce.number().optional().openapi({
        description: 'Minimum aggregate rating threshold (6, 8, or 10 legacy scale).',
      }),
      limit: z.coerce.number().int().min(1).max(50).optional().openapi({
        description: 'Page size (default 20, max 50).',
      }),
      cursor: z.string().optional().openapi({
        description: 'Opaque keyset cursor returned by the previous page (weight + object_id).',
      }),
      country: z.string().trim().max(32).optional().openapi({
        description: 'ISO 3166-1 alpha-2 or affiliate geo token; overrides GeoIP when valid.',
      }),
    }),
  },
  responses: {
    200: { description: 'Projected objects `{ items, cursor, hasMore }` with optional affiliateLinks.' },
    400: badRequestResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/shop-sections',
  tags: [queryApiOpenApiTags.users],
  summary: 'Favorites category sections for a user',
  description:
    'One section per non-empty child category of the selected lineage (same candidates and order as `GET …/categories`, with `tags`/`rating` applied). `totalObjects` is always the live count of the section leaf list (Favorites scope ∩ `path` + `name` + section, same filters); sections with 0 are omitted. Previews are the top 3 by `weight DESC NULLS LAST`. Needs exactly one category type; other `types` return no sections. Optional `country` overrides GeoIP for affiliate links.',
  request: {
    params: z.object({
      name: z.string().min(1).openapi({ param: { name: 'name', in: 'path', required: true } }),
    }),
    query: z.object({
      types: z.union([z.string(), z.array(z.string())]).openapi({
        description: 'Repeatable, required. Every entry must be in `USER_FAVORITES_OBJECT_TYPES`, otherwise 400.',
      }),
      name: z.string().optional().openapi({
        description: 'Parent department name for drill-down (omit at root).',
      }),
      path: z.union([z.string(), z.array(z.string())]).optional().openapi({
        description: 'Ancestor category names before name.',
      }),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      rating: z.coerce.number().optional(),
      cursor: z.string().optional().openapi({
        description: 'Last category name from previous page.',
      }),
      sectionLimit: z.coerce.number().int().min(1).max(10).optional().openapi({
        description: 'Max category sections per page (default 3).',
      }),
      country: z.string().trim().max(32).optional().openapi({
        description: 'ISO 3166-1 alpha-2 or affiliate geo token; overrides GeoIP when valid.',
      }),
    }),
  },
  responses: {
    200: { description: 'Sections `{ sections, cursor, hasMore }` with optional affiliateLinks on items.' },
    400: badRequestResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/shop/filters',
  tags: [queryApiOpenApiTags.users],
  summary: 'Tag and rating filter facets for a user Favorites type',
  description:
    'Returns tag category facets over the unified Favorites scope (favorites ∪ authored post links − deselect; no ownership) and optional categoryPath. Ratings are static thresholds.',
  request: {
    params: z.object({
      name: z.string().min(1).openapi({ param: { name: 'name', in: 'path', required: true } }),
    }),
    query: z.object({
      types: z.union([z.string(), z.array(z.string())]).openapi({
        description: 'Repeatable, required. Every entry must be in `USER_FAVORITES_OBJECT_TYPES`, otherwise 400.',
      }),
      categoryPath: z.union([z.string(), z.array(z.string())]).optional(),
      uncategorizedOnly: z.union([z.boolean(), z.string()]).optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      rating: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Tag facets and rating thresholds for the Favorites scope.',
      content: {
        'application/json': {
          schema: userShopFiltersResponseSchema,
        },
      },
    },
    400: badRequestResponse,
  },
});
