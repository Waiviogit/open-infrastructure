import type { Request, Response } from 'express';

/**
 * Plain GET on a stateless Streamable HTTP MCP endpoint.
 * MCP clients that GET for an SSE stream get the spec answer (405).
 * Everyone else (agent web-fetch, curl, browser) gets a 200 markdown guide,
 * because many fetch tools drop 4xx bodies and the agent would learn nothing.
 * @see docs/deployment/mcp-endpoints.md
 */
export interface McpGetGuide {
  /** Key for the client config snippet, e.g. `odl-knowledge`. */
  serverName: string;
  title: string;
  summary: string;
  firstSteps: readonly string[];
  related?: readonly McpRelatedServer[];
}

export interface McpRelatedServer {
  title: string;
  /** Public path on the same origin, e.g. `/query/mcp`. */
  path: string;
}

export const MCP_SSE_MEDIA_TYPE = 'text/event-stream';
export const MCP_GET_ALLOW_HEADER = 'POST';
export const MCP_GET_NOT_ALLOWED_STATUS = 405;
export const MCP_GET_GUIDE_STATUS = 200;
export const MCP_GET_GUIDE_CONTENT_TYPE = 'text/markdown; charset=utf-8';
/** JSON-RPC server error code the MCP SDK uses for "Method not allowed". */
export const MCP_JSON_RPC_METHOD_NOT_ALLOWED_CODE = -32000;
export const MCP_GET_NOT_ALLOWED_MESSAGE =
  'Method not allowed: stateless MCP server, no SSE stream. Send JSON-RPC with POST to this URL.';
export const ODL_SKILLS_INSTALL_COMMAND =
  'npx skills add https://github.com/Waiviogit/skills';

const ALLOWED_PROTOCOLS = new Set(['http', 'https']);
const HOST_PATTERN = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;

function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(',')[0]?.trim().toLowerCase();
}

/** Public origin of the request, or `''` when headers do not look trustworthy. */
export function resolveRequestOrigin(req: Request): string {
  const host = req.get('host')?.trim();
  if (!host || !HOST_PATTERN.test(host)) return '';

  const forwardedProto = firstHeaderValue(req.get('x-forwarded-proto'));
  const protocol =
    forwardedProto && ALLOWED_PROTOCOLS.has(forwardedProto)
      ? forwardedProto
      : req.protocol;
  if (!ALLOWED_PROTOCOLS.has(protocol)) return '';

  return `${protocol}://${host.toLowerCase()}`;
}

export function wantsMcpSseStream(req: Request): boolean {
  return (req.get('accept') ?? '').toLowerCase().includes(MCP_SSE_MEDIA_TYPE);
}

export function buildMcpGetGuideMarkdown(
  guide: McpGetGuide,
  origin: string,
  path: string,
): string {
  const endpointUrl = `${origin}${path}`;
  const clientConfig = JSON.stringify(
    { mcpServers: { [guide.serverName]: { url: endpointUrl } } },
    null,
    2,
  );
  const initializeBody = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'agent', version: '1.0.0' },
    },
  });
  const steps = guide.firstSteps.map((step, i) => `${i + 1}. ${step}`);
  const related = (guide.related ?? []).map(
    (server) => `- ${server.title}: ${origin}${server.path}`,
  );

  return [
    `# ${guide.title}`,
    '',
    `You opened ${endpointUrl} with GET. This URL is an MCP server (Model Context Protocol, Streamable HTTP, stateless), not a web page or REST API. Nothing is wrong and no auth is needed: send JSON-RPC 2.0 requests to this same URL with POST.`,
    '',
    guide.summary,
    '',
    '## Connect an MCP client',
    '',
    '```json',
    clientConfig,
    '```',
    '',
    `Claude Code: \`claude mcp add --transport http ${guide.serverName} ${endpointUrl}\``,
    '',
    '## Call it without an MCP client',
    '',
    'Every request: `POST`, `Content-Type: application/json`, `Accept: application/json, text/event-stream` (without `text/event-stream` the server answers 406).',
    '',
    '```sh',
    `curl -s ${endpointUrl} \\`,
    `  -H 'content-type: application/json' \\`,
    `  -H 'accept: application/json, text/event-stream' \\`,
    `  -d '${initializeBody}'`,
    '```',
    '',
    'Then `tools/list`, `tools/call`, `resources/list`, `resources/read` the same way. The `initialize` result carries the full server instructions.',
    '',
    '## First steps',
    '',
    ...steps,
    '',
    `Install ODL skills locally (preferred over reading them through MCP): \`${ODL_SKILLS_INSTALL_COMMAND}\``,
    ...(related.length ? ['', '## Related MCP servers', '', ...related] : []),
    '',
  ].join('\n');
}

export function respondToMcpGet(
  req: Request,
  res: Response,
  guide: McpGetGuide,
  path: string,
): void {
  if (wantsMcpSseStream(req)) {
    res
      .status(MCP_GET_NOT_ALLOWED_STATUS)
      .set('Allow', MCP_GET_ALLOW_HEADER)
      .json({
        jsonrpc: '2.0',
        error: {
          code: MCP_JSON_RPC_METHOD_NOT_ALLOWED_CODE,
          message: MCP_GET_NOT_ALLOWED_MESSAGE,
        },
        id: null,
      });
    return;
  }

  res
    .status(MCP_GET_GUIDE_STATUS)
    .set('Content-Type', MCP_GET_GUIDE_CONTENT_TYPE)
    .set('X-Robots-Tag', 'noindex')
    .send(buildMcpGetGuideMarkdown(guide, resolveRequestOrigin(req), path));
}
