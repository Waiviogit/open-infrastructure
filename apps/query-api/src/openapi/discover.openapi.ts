import { z } from 'zod';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const discoverTagCategoryItemSchema = registry.register(
  'DiscoverTagCategoryItemDto',
  z.object({
    value: z.string(),
    count: z.number().int(),
  }),
);

const discoverTagCategorySectionSchema = registry.register(
  'DiscoverTagCategorySectionDto',
  z.object({
    category: z.string(),
    items: z.array(discoverTagCategoryItemSchema),
  }),
);

const discoverTagCategoriesResponseSchema = registry.register(
  'DiscoverTagCategoriesResponseDto',
  z.object({
    categories: z.array(discoverTagCategorySectionSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/discover/objects',
  tags: [queryApiOpenApiTags.discover],
  summary: 'Discover object feed',
  description:
    'Paginated discover objects. Optional `country` overrides GeoIP for affiliate link geo cascade.',
  request: {
    query: z.object({
      object_type: z.string().min(1).optional(),
      q: z.string().max(100).optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      sort: z.enum(['newest', 'oldest', 'rank']).optional(),
      box: z.string().optional().describe('Map bounding box as swLng,swLat,neLng,neLat'),
      category_path: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Category lineage filter, root first (objects must carry every name)'),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).optional(),
      country: z.string().trim().max(32).optional().openapi({
        description: 'ISO 3166-1 alpha-2 or affiliate geo token; overrides GeoIP when valid.',
      }),
    }),
  },
  responses: {
    200: { description: 'Paginated discover objects with optional affiliateLinks.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/discover/tag-categories',
  tags: [queryApiOpenApiTags.discover],
  summary: 'Tag category facets for discover filters',
  description:
    'Tag values grouped by category for an object type. Each count is the number of distinct active product groups (`COALESCE(meta_group_id, object_id)`), not individual option SKUs.',
  request: {
    query: z.object({
      object_type: z.string().min(1),
      q: z.string().max(100).optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      box: z.string().optional().describe('Map bounding box as swLng,swLat,neLng,neLat'),
      category_path: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Category lineage filter, root first'),
    }),
  },
  responses: {
    200: {
      description:
        'Tag values grouped by category. Counts are distinct active meta_group_id groups.',
      content: {
        'application/json': {
          schema: discoverTagCategoriesResponseSchema,
        },
      },
    },
  },
});

const discoverCategoryItemSchema = registry.register(
  'DiscoverCategoryItemDto',
  z.object({
    name: z.string(),
    objects_count: z.number().int(),
    has_children: z.boolean(),
  }),
);

const discoverCategoriesResponseSchema = registry.register(
  'DiscoverCategoriesResponseDto',
  z.object({
    items: z.array(discoverCategoryItemSchema),
    show_other: z.boolean(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/discover/categories',
  tags: [queryApiOpenApiTags.discover],
  summary: 'Category tree level for an object type',
  description:
    'Children of `category_path` over every active object of a category type. Counts are distinct active product groups (`COALESCE(meta_group_id, object_id)`) narrowed by `q`, `tags` and `box`. A category with fewer than 3 groups, or covering more than 60% of the level, is not listed. The unfiltered root is served from the precomputed type scope; unfiltered levels are cached for 600 s.',
  request: {
    query: z.object({
      object_type: z.string().min(1).describe('Category object type, e.g. product'),
      category_path: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Selected lineage, root first (repeat the parameter); omit for the root'),
      q: z.string().max(100).optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      box: z.string().optional().describe('Map bounding box as swLng,swLat,neLng,neLat'),
    }),
  },
  responses: {
    200: {
      description: 'One level of the category tree.',
      content: { 'application/json': { schema: discoverCategoriesResponseSchema } },
    },
  },
});
