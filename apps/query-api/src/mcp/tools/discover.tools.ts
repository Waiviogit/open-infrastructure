import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  discoverCategoriesQuerySchema,
  discoverObjectsQuerySchema,
  discoverSectionsQuerySchema,
  discoverTagCategoriesQuerySchema,
  discoverUsersQuerySchema,
} from '../../domain/discover';
import { catalogDescription } from '../mcp-tool-catalog';
import type { McpToolDeps } from '../mcp-tool.deps';
import {
  jsonToolResult,
  pickMcpContext,
  resolveMcpCountry,
  withMcpLocaleContext,
} from '../mcp-tool.helpers';

export function registerDiscoverTools(server: McpServer, deps: McpToolDeps): void {
  server.registerTool(
    'discover_objects',
    {
      description: catalogDescription('discover_objects'),
      inputSchema: withMcpLocaleContext(discoverObjectsQuerySchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      const result = await deps.discoverObjects.execute({
        query: {
          object_type: args.object_type,
          q: args.q,
          tags: args.tags,
          sort: args.sort,
          box: args.box,
          category_path: args.category_path,
          other: args.other,
          cursor: args.cursor,
          limit: args.limit,
        },
        locale: ctx.locale,
        viewerAccount: ctx.viewerAccount,
        governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
        countryCode: resolveMcpCountry(deps, args.country),
      });
      return jsonToolResult(result);
    },
  );

  server.registerTool(
    'discover_users',
    {
      description: catalogDescription('discover_users'),
      inputSchema: discoverUsersQuerySchema.extend({
        viewer: z.string().optional().describe('Hive account name of the viewer'),
      }),
    },
    async (args) => {
      const { viewer, ...query } = args;
      const result = await deps.discoverUsers.execute({
        query,
        viewerAccount: viewer?.trim() || undefined,
      });
      return jsonToolResult(result);
    },
  );

  server.registerTool(
    'discover_tag_categories',
    {
      description: catalogDescription('discover_tag_categories'),
      inputSchema: discoverTagCategoriesQuerySchema,
    },
    async (args) => {
      const result = await deps.discoverTagCategories.execute({ query: args });
      return jsonToolResult(result);
    },
  );

  server.registerTool(
    'discover_categories',
    {
      description: catalogDescription('discover_categories'),
      inputSchema: discoverCategoriesQuerySchema,
    },
    async (args) => {
      const result = await deps.discoverCategories.execute({ query: args });
      return jsonToolResult(result);
    },
  );

  server.registerTool(
    'discover_sections',
    {
      description: catalogDescription('discover_sections'),
      inputSchema: withMcpLocaleContext(discoverSectionsQuerySchema),
    },
    async (args) => {
      const ctx = pickMcpContext(args);
      const result = await deps.discoverSections.execute({
        query: {
          object_type: args.object_type,
          category_path: args.category_path,
          cursor: args.cursor,
          section_limit: args.section_limit,
        },
        locale: ctx.locale,
        viewerAccount: ctx.viewerAccount,
        governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
        countryCode: resolveMcpCountry(deps, args.country),
      });
      return jsonToolResult(result);
    },
  );
}
