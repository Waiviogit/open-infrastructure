import type { McpGetGuide } from '@opden-data-layer/clients';

export const QUERY_MCP_PATH = 'mcp';
export const QUERY_MCP_PUBLIC_PATH = '/query/mcp';
export const KNOWLEDGE_MCP_PUBLIC_PATH = '/mcp';

/** Answer to a plain GET on the MCP URL. @see docs/deployment/mcp-endpoints.md */
export const QUERY_MCP_GET_GUIDE: McpGetGuide = {
  serverName: 'odl-query',
  title: 'ODL Query MCP server (live data)',
  summary:
    'Read-only live data mirror of query-api: objects, users, feeds, posts, Favorites, currency rates. Returns current platform state, not documentation. Public, no auth.',
  firstSteps: [
    'POST `initialize` and read `result.instructions` (decision table: intent → tool).',
    'Read resource `odl-query://routing`, then `odl-query://catalog/tools` for the full tool list.',
    'Pass `locale` / `viewer` as tool arguments; they replace HTTP headers.',
    'To learn how a feature works, use the knowledge MCP below, not search here.',
  ],
  related: [
    {
      title: 'Docs, specs and skills (knowledge)',
      path: KNOWLEDGE_MCP_PUBLIC_PATH,
    },
  ],
};
