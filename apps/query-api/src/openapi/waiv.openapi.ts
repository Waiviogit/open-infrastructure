import { z } from 'zod';

import {
  waivStatsResponseSchema,
  waivSwapsQuerySchema,
  waivSwapsResponseSchema,
} from '../domain/waiv/schemas/waiv.schema';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const errorSchema = <Status extends number>(statusCode: Status) =>
  z.object({
    statusCode: z.literal(statusCode),
    message: z.string(),
    error: z.string(),
  });

const waivStatsSchema = registry.register('WaivStatsResponse', waivStatsResponseSchema);
const waivSwapsSchema = registry.register('WaivSwapsResponse', waivSwapsResponseSchema);

registry.registerPath({
  method: 'get',
  path: '/query/v1/waiv/stats',
  tags: [queryApiOpenApiTags.waiv],
  summary: 'WAIV token stats',
  description:
    'Price (stored `hive_engine_rates` head), Hive Engine supply (`tokens.tokens`), market cap, tokenomics constants, development fund (`tokenfunds.proposals`) and holders / monthly active accounts (engine-statistic, null when unavailable). Cached 5 min. Price history: `GET /query/v1/currency/engine/chart`.',
  responses: {
    200: {
      description: 'Assembled stats.',
      content: { 'application/json': { schema: waivStatsSchema } },
    },
    503: {
      description: 'Hive Engine did not answer.',
      content: { 'application/json': { schema: errorSchema(503) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/query/v1/waiv/swaps',
  tags: [queryApiOpenApiTags.waiv],
  summary: 'WAIV/SWAP.HIVE pool swap history (all accounts)',
  description:
    'Indexed `marketpools.swapTokens` swaps of every account in the WAIV pool, newest first. Pass the returned `cursor` for the next page.',
  request: { query: waivSwapsQuerySchema },
  responses: {
    200: {
      description: 'One page of swaps.',
      content: { 'application/json': { schema: waivSwapsSchema } },
    },
    400: {
      description: 'Invalid query or cursor.',
      content: { 'application/json': { schema: errorSchema(400) } },
    },
  },
});
