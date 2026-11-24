import { z } from 'zod';

import {
  hiveChangellyDepositCreateBodySchema,
  hiveChangellyDepositCreateResponseSchema,
  hiveChangellyDepositCurrenciesQuerySchema,
  hiveChangellyDepositCurrenciesResponseSchema,
  hiveChangellyDepositEstimateBodySchema,
  hiveChangellyDepositEstimateResponseSchema,
  hiveChangellyDepositHistoryQuerySchema,
  hiveChangellyDepositHistoryResponseSchema,
  hiveChangellyDepositItemSchema,
  hiveChangellyDepositRangeQuerySchema,
  hiveChangellyDepositRangeResponseSchema,
  hiveChangellyDepositStatusParamsSchema,
} from '../domain/wallet/schemas/hive-changelly-deposit.schema';
import { registry } from './registry';
import { queryApiOpenApiTags } from './tags';

const errorSchema = <Status extends number>(statusCode: Status) =>
  z.object({
    statusCode: z.literal(statusCode),
    message: z.string(),
    error: z.string(),
  });

const badRequestSchema = errorSchema(400);
const notFoundSchema = errorSchema(404);
const serviceUnavailableSchema = errorSchema(503);

const accountNameParam = z
  .string()
  .min(1)
  .openapi({ example: 'alice', description: 'Hive account that receives HIVE' });

const jsonContent = (schema: z.ZodType) => ({ 'application/json': { schema } });

const userErrorResponses = (badRequest: string) => ({
  400: { description: badRequest, content: jsonContent(badRequestSchema) },
  404: { description: 'Unknown account.', content: jsonContent(notFoundSchema) },
  503: { description: 'Changelly unavailable.', content: jsonContent(serviceUnavailableSchema) },
});

const currenciesQueryOpenApi = registry.register(
  'HiveChangellyDepositCurrenciesQuery',
  hiveChangellyDepositCurrenciesQuerySchema,
);
const currenciesResponseOpenApi = registry.register(
  'HiveChangellyDepositCurrenciesResponse',
  hiveChangellyDepositCurrenciesResponseSchema,
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/wallet/hive/deposit/currencies',
  tags: [queryApiOpenApiTags.userWallet],
  summary: 'Coins Changelly converts into HIVE',
  description:
    'Pay-in coins with network, protocol, extra-id name and Changelly pay-in warning. The ticker fixes the network (usdt20 = ERC20, usdtrx = TRC20).',
  request: { query: currenciesQueryOpenApi },
  responses: {
    200: { description: 'Matching coins.', content: jsonContent(currenciesResponseOpenApi) },
    400: { description: 'Invalid query.', content: jsonContent(badRequestSchema) },
    503: { description: 'Changelly unavailable.', content: jsonContent(serviceUnavailableSchema) },
  },
});

const rangeQueryOpenApi = registry.register(
  'HiveChangellyDepositRangeQuery',
  hiveChangellyDepositRangeQuerySchema,
);
const rangeResponseOpenApi = registry.register(
  'HiveChangellyDepositRangeResponse',
  hiveChangellyDepositRangeResponseSchema,
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/wallet/hive/deposit/range',
  tags: [queryApiOpenApiTags.userWallet],
  summary: 'Changelly deposit limits for a coin → HIVE',
  request: {
    params: z.object({ name: accountNameParam }),
    query: rangeQueryOpenApi,
  },
  responses: {
    200: { description: 'Min/max pay-in amount.', content: jsonContent(rangeResponseOpenApi) },
    ...userErrorResponses('Unsupported coin, or fixed rate not available for it.'),
  },
});

const estimateBodyOpenApi = registry.register(
  'HiveChangellyDepositEstimateBody',
  hiveChangellyDepositEstimateBodySchema,
);
const estimateResponseOpenApi = registry.register(
  'HiveChangellyDepositEstimateResponse',
  hiveChangellyDepositEstimateResponseSchema,
);

registry.registerPath({
  method: 'post',
  path: '/query/v1/users/{name}/wallet/hive/deposit/estimate',
  tags: [queryApiOpenApiTags.userWallet],
  summary: 'Changelly deposit estimate (coin → HIVE)',
  request: {
    params: z.object({ name: accountNameParam }),
    body: { content: jsonContent(estimateBodyOpenApi) },
  },
  responses: {
    200: {
      description: 'HIVE before and after the payout network fee.',
      content: jsonContent(estimateResponseOpenApi),
    },
    ...userErrorResponses('Unsupported coin or amount outside Changelly limits.'),
  },
});

const createBodyOpenApi = registry.register(
  'HiveChangellyDepositCreateBody',
  hiveChangellyDepositCreateBodySchema,
);
const createResponseOpenApi = registry.register(
  'HiveChangellyDepositCreateResponse',
  hiveChangellyDepositCreateResponseSchema,
);

registry.registerPath({
  method: 'post',
  path: '/query/v1/users/{name}/wallet/hive/deposit/create',
  tags: [queryApiOpenApiTags.userWallet],
  summary: 'Create a Changelly deposit into a Hive account',
  description:
    'Creates a Changelly exchange that pays HIVE out to {name} and returns the pay-in address. Nothing is signed or broadcast; the sender pays from their own wallet. Without payment the exchange expires (overdue / expired).',
  request: {
    params: z.object({ name: accountNameParam }),
    body: { content: jsonContent(createBodyOpenApi) },
  },
  responses: {
    200: {
      description: 'Pay-in routing and exchange id.',
      content: jsonContent(createResponseOpenApi),
    },
    ...userErrorResponses(
      'Unsupported coin, amount outside limits, invalid refund address, or fixed rate without refundAddress.',
    ),
  },
});

const statusParamsOpenApi = hiveChangellyDepositStatusParamsSchema.extend({
  name: accountNameParam,
});
const depositItemOpenApi = registry.register(
  'HiveChangellyDepositItem',
  hiveChangellyDepositItemSchema,
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/wallet/hive/deposit/status/{exchangeId}',
  tags: [queryApiOpenApiTags.userWallet],
  summary: 'Changelly deposit status',
  description:
    'Live Changelly status. The pay-in address is returned only while the exchange waits for the payment.',
  request: { params: statusParamsOpenApi },
  responses: {
    200: { description: 'Exchange status.', content: jsonContent(depositItemOpenApi) },
    400: { description: 'Invalid exchange id.', content: jsonContent(badRequestSchema) },
    404: {
      description: 'Unknown account, or no Changelly deposit with this id pays this account.',
      content: jsonContent(notFoundSchema),
    },
    503: { description: 'Changelly unavailable.', content: jsonContent(serviceUnavailableSchema) },
  },
});

const historyQueryOpenApi = registry.register(
  'HiveChangellyDepositHistoryQuery',
  hiveChangellyDepositHistoryQuerySchema,
);
const historyResponseOpenApi = registry.register(
  'HiveChangellyDepositHistoryResponse',
  hiveChangellyDepositHistoryResponseSchema,
);

registry.registerPath({
  method: 'get',
  path: '/query/v1/users/{name}/wallet/hive/deposit/history',
  tags: [queryApiOpenApiTags.userWallet],
  summary: 'Changelly deposits into a Hive account',
  description:
    'Exchanges created with the platform Changelly key that pay HIVE out to {name}. Use it to recover a lost exchange id.',
  request: {
    params: z.object({ name: accountNameParam }),
    query: historyQueryOpenApi,
  },
  responses: {
    200: { description: 'Deposit exchanges.', content: jsonContent(historyResponseOpenApi) },
    ...userErrorResponses('Invalid query.'),
  },
});
