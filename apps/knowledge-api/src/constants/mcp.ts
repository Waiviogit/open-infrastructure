import type { McpGetGuide } from '@opden-data-layer/clients';

/** Public MCP path; excluded from the `knowledge` global prefix. */
export const KNOWLEDGE_MCP_PATH = 'mcp';
export const KNOWLEDGE_MCP_PUBLIC_PATH = `/${KNOWLEDGE_MCP_PATH}`;
export const QUERY_MCP_PUBLIC_PATH = '/query/mcp';

/** Answer to a plain GET on the MCP URL. @see docs/deployment/mcp-endpoints.md */
export const KNOWLEDGE_MCP_GET_GUIDE: McpGetGuide = {
  serverName: 'odl-knowledge',
  title: 'ODL Knowledge MCP server',
  summary:
    'Project knowledge base for agents: Open Data Layer docs, specs, skills (procedural playbooks), object-create playbooks, and the object/update registries. Read-only, public.',
  firstSteps: [
    'POST `initialize` and read `result.instructions` (workflow and key paths).',
    'Read resource `odl-knowledge://routing` (or `get_file({ path: "odl/knowledge-api-routing/SKILL.md" })`).',
    '`resolve_doc({ topic: "<your task>" })`, then `get_file(path)` for the full markdown.',
    '`list_files({ type: "skill" })` lists skills with one-line descriptions.',
  ],
  related: [
    {
      title: 'Live platform data (objects, users, posts, rates)',
      path: QUERY_MCP_PUBLIC_PATH,
    },
  ],
};
