import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import {
  HubFeedViewerRequiredError,
  hubActivityFeedBodyFieldsSchema,
  hubPostsFeedBodyFieldsSchema,
  hubThreadsFeedBodyFieldsSchema,
  hubUpdatesFeedBodyFieldsSchema,
} from '../../domain/hub-feed';
import { catalogDescription } from '../mcp-tool-catalog';
import type { McpToolDeps } from '../mcp-tool.deps';
import { jsonToolResult, pickMcpContext, toolError, withMcpLocaleContext } from '../mcp-tool.helpers';

async function runHubFeedTool(load: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonToolResult(await load());
  } catch (error) {
    if (error instanceof HubFeedViewerRequiredError) {
      return toolError('filter "my" needs the viewer argument');
    }
    throw error;
  }
}

/** Hub start page tabs (same filters and cursors as `POST /query/v1/feed/{tab}`). */
export function registerHubFeedTools(server: McpServer, deps: McpToolDeps): void {
  server.registerTool(
    'get_hub_feed_posts',
    {
      description: catalogDescription('get_hub_feed_posts'),
      inputSchema: withMcpLocaleContext(hubPostsFeedBodyFieldsSchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      return runHubFeedTool(() =>
        deps.getHubPostsFeed.execute(
          { limit: args.limit, cursor: args.cursor, currency: args.currency, filter: args.filter },
          ctx.locale,
          ctx.governanceObjectIdFromHeader,
          ctx.viewerAccount,
        ),
      );
    },
  );

  server.registerTool(
    'get_hub_feed_threads',
    {
      description: catalogDescription('get_hub_feed_threads'),
      inputSchema: withMcpLocaleContext(hubThreadsFeedBodyFieldsSchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      return runHubFeedTool(() =>
        deps.getHubThreadsFeed.execute(
          { limit: args.limit, cursor: args.cursor, filter: args.filter },
          ctx.locale,
          ctx.governanceObjectIdFromHeader,
          ctx.viewerAccount,
        ),
      );
    },
  );

  server.registerTool(
    'get_hub_feed_activity',
    {
      description: catalogDescription('get_hub_feed_activity'),
      inputSchema: withMcpLocaleContext(hubActivityFeedBodyFieldsSchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      return runHubFeedTool(() =>
        deps.getHubActivityFeed.execute(
          { limit: args.limit, cursor: args.cursor, filter: args.filter },
          ctx.governanceObjectIdFromHeader,
          ctx.viewerAccount,
        ),
      );
    },
  );

  server.registerTool(
    'get_hub_feed_updates',
    {
      description: catalogDescription('get_hub_feed_updates'),
      inputSchema: withMcpLocaleContext(hubUpdatesFeedBodyFieldsSchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      return runHubFeedTool(() =>
        deps.getHubUpdatesFeed.execute(
          { limit: args.limit, cursor: args.cursor, filter: args.filter },
          ctx.locale,
          ctx.governanceObjectIdFromHeader,
          ctx.viewerAccount,
        ),
      );
    },
  );
}
