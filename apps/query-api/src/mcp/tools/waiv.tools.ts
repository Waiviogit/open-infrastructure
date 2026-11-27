import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  InvalidWaivSwapsCursorError,
  WaivStatsUnavailableError,
  waivSwapsQuerySchema,
} from '../../domain/waiv';
import { catalogDescription } from '../mcp-tool-catalog';
import type { McpToolDeps } from '../mcp-tool.deps';
import { jsonToolResult, toolError } from '../mcp-tool.helpers';

export function registerWaivTools(server: McpServer, deps: McpToolDeps): void {
  server.registerTool(
    'get_waiv_stats',
    {
      description: catalogDescription('get_waiv_stats'),
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return jsonToolResult(await deps.getWaivStats.execute());
      } catch (e) {
        if (e instanceof WaivStatsUnavailableError) {
          return toolError(e.message);
        }
        throw e;
      }
    },
  );

  server.registerTool(
    'get_waiv_swaps',
    {
      description: catalogDescription('get_waiv_swaps'),
      inputSchema: waivSwapsQuerySchema,
    },
    async (args) => {
      try {
        return jsonToolResult(await deps.getWaivSwaps.execute(args));
      } catch (e) {
        if (e instanceof InvalidWaivSwapsCursorError) {
          return toolError(e.message);
        }
        throw e;
      }
    },
  );
}
