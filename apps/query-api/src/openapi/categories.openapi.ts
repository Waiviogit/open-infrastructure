import { z } from 'zod';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';
import { userCategoriesQuerySchema } from '../domain/categories/categories-query.schema';
import { categoryObjectsQuerySchema } from '../domain/categories/category-objects-query.schema';

const itemSchema = registry.register(
  'CategoryNavItem',
  z.object({
    name: z.string(),
    objects_count: z.number().int().positive().openapi({
      description: 'Live object count in the Favorites scope ∩ lineage + name (same set as the leaf list).',
    }),
    has_children: z.boolean().openapi({
      description: 'True when drilling into this name lists at least one non-empty child.',
    }),
  }),
);

const categoriesResponseSchema = registry.register(
  'UserCategoriesResponse',
  z.object({
    items: z.array(itemSchema),
    uncategorized_count: z.number().int().nonnegative().openapi({
      description: 'Live count of scope objects without categories at the root; always 0 below the root.',
    }),
    show_other: z.boolean(),
  }),
);

const badRequestSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
  issues: z.unknown().optional(),
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/categories',
  tags: [queryApiOpenApiTags.users],
  summary: 'Category navigation for one Favorites type of a user',
  description:
    '`types` must be exactly one category object type (`CATEGORY_OBJECT_TYPES`), otherwise 400; there is no default. Precomputed `object_categories_related` rows (`scope_key = account:type`) only choose candidate names and their order. Every `objects_count` is a live `COUNT(DISTINCT object_id)` over the Favorites scope (favorites ∪ authored post links − deselect, per-type hide flags) intersected with the full lineage (`path` + `name` + child); children with an empty intersection are omitted and `has_children` is true only when a grandchild intersection is non-empty. `uncategorized_count` is live at the root and 0 below it. Root list when `name` is omitted; drill-down when `name` and optional `path` are set.',
  request: {
    params: z.object({
      name: z
        .string()
        .min(1)
        .openapi({ param: { name: 'name', in: 'path', required: true } }),
    }),
    query: userCategoriesQuerySchema,
  },
  responses: {
    200: {
      description: 'Category navigation slice.',
      content: {
        'application/json': {
          schema: categoriesResponseSchema,
        },
      },
    },
    400: {
      description:
        'Query validation failed (Zod): `types` missing, several types, or a type without categories.',
      content: {
        'application/json': {
          schema: badRequestSchema,
        },
      },
    },
  },
});

const categoryRefListResponseSchema = registry.register(
  'CategoryObjectsResponse',
  z.object({
    items: z.array(
      z.object({
        object_id: z.string(),
        object_type: z.string(),
        fields: z.record(z.string(), z.unknown()),
        weight: z.number().nullable(),
        addedAtUnix: z.number().optional(),
        listItemsCount: z.number().int().optional(),
        isFavorited: z.boolean().optional(),
      }),
    ),
    hasMore: z.boolean(),
    cursor: z.string().nullable(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/categories/objects',
  tags: [queryApiOpenApiTags.categories],
  summary: 'Global objects by department category name',
  description:
    'Returns active objects whose materialized `object_categories.category_names` contain the given name (array overlap). Results are collapsed by `meta_group_id`, ordered by `weight DESC NULLS LAST`, and projected as compact `RefSummary` rows. Keyset cursor encodes weight + object_id.',
  request: {
    query: categoryObjectsQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated category object feed.',
      content: {
        'application/json': {
          schema: categoryRefListResponseSchema,
        },
      },
    },
    400: {
      description: 'Query validation failed (Zod).',
      content: {
        'application/json': {
          schema: badRequestSchema,
        },
      },
    },
  },
});
