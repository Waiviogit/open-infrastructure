import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  hiveChangellyDepositCreateBodySchema,
  hiveChangellyDepositCurrenciesQuerySchema,
  hiveChangellyDepositEstimateBodySchema,
  hiveChangellyDepositHistoryQuerySchema,
  hiveChangellyDepositRangeQuerySchema,
  hiveChangellyDepositStatusParamsSchema,
} from '../../domain/wallet/schemas/hive-changelly-deposit.schema';
import { catalogDescription } from '../mcp-tool-catalog';
import type { McpToolDeps } from '../mcp-tool.deps';
import { jsonToolResult, toolError } from '../mcp-tool.helpers';

const destinationAccountField = {
  account: z.string().min(1).describe('Hive account that receives HIVE (any account, not only the caller)'),
} as const;

/** `null` from an endpoint means the account is unknown; HTTP errors become tool errors. */
async function runDepositTool<T>(
  account: string | null,
  run: () => Promise<T | null>,
): Promise<CallToolResult> {
  try {
    const result = await run();
    if (result === null) {
      return toolError(`User not found: ${account}`);
    }
    return jsonToolResult(result);
  } catch (e) {
    return toolError((e as Error).message);
  }
}

/** Changelly deposits: any supported coin → HIVE into a Hive account. */
export function registerWalletDepositTools(server: McpServer, deps: McpToolDeps): void {
  server.registerTool(
    'get_hive_deposit_currencies',
    {
      description: catalogDescription('get_hive_deposit_currencies'),
      inputSchema: hiveChangellyDepositCurrenciesQuerySchema,
    },
    async (args) => runDepositTool(null, () => deps.getHiveDepositCurrencies.execute(args)),
  );

  server.registerTool(
    'get_user_hive_deposit_range',
    {
      description: catalogDescription('get_user_hive_deposit_range'),
      inputSchema: hiveChangellyDepositRangeQuerySchema.extend(destinationAccountField),
    },
    async ({ account, ...query }) =>
      runDepositTool(account, () => deps.getUserHiveDepositRange.execute(account, query)),
  );

  server.registerTool(
    'post_user_hive_deposit_estimate',
    {
      description: catalogDescription('post_user_hive_deposit_estimate'),
      inputSchema: hiveChangellyDepositEstimateBodySchema.extend(destinationAccountField),
    },
    async ({ account, ...body }) =>
      runDepositTool(account, () => deps.postUserHiveDepositEstimate.execute(account, body)),
  );

  server.registerTool(
    'post_user_hive_deposit_create',
    {
      description: catalogDescription('post_user_hive_deposit_create'),
      inputSchema: hiveChangellyDepositCreateBodySchema.extend(destinationAccountField),
    },
    async ({ account, ...body }) =>
      runDepositTool(account, () => deps.postUserHiveDepositCreate.execute(account, body)),
  );

  server.registerTool(
    'get_user_hive_deposit_status',
    {
      description: catalogDescription('get_user_hive_deposit_status'),
      inputSchema: hiveChangellyDepositStatusParamsSchema.extend(destinationAccountField),
    },
    async ({ account, ...params }) =>
      runDepositTool(account, () => deps.getUserHiveDepositStatus.execute(account, params)),
  );

  server.registerTool(
    'get_user_hive_deposit_history',
    {
      description: catalogDescription('get_user_hive_deposit_history'),
      inputSchema: hiveChangellyDepositHistoryQuerySchema.extend(destinationAccountField),
    },
    async ({ account, ...query }) =>
      runDepositTool(account, () => deps.getUserHiveDepositHistory.execute(account, query)),
  );
}
