import express, { type Request } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  buildMcpGetGuideMarkdown,
  MCP_GET_NOT_ALLOWED_MESSAGE,
  ODL_SKILLS_INSTALL_COMMAND,
  resolveRequestOrigin,
  respondToMcpGet,
  type McpGetGuide,
} from './mcp-get-guide';

const GUIDE: McpGetGuide = {
  serverName: 'odl-test',
  title: 'Test MCP',
  summary: 'Test summary.',
  firstSteps: ['Read the routing resource.', 'Call list_files.'],
  related: [{ title: 'Live data', path: '/query/mcp' }],
};

function fakeRequest(
  headers: Record<string, string>,
  protocol = 'http',
): Request {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    protocol,
    get: (name: string) => lower[name.toLowerCase()],
  } as unknown as Request;
}

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.get('/mcp', (req, res) => respondToMcpGet(req, res, GUIDE, '/mcp'));
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('resolveRequestOrigin', () => {
  it('uses X-Forwarded-Proto and Host behind nginx', () => {
    const req = fakeRequest({
      host: 'Example.com',
      'x-forwarded-proto': 'https',
    });
    expect(resolveRequestOrigin(req)).toBe('https://example.com');
  });

  it('takes the first X-Forwarded-Proto hop', () => {
    const req = fakeRequest({
      host: 'example.com',
      'x-forwarded-proto': 'https, http',
    });
    expect(resolveRequestOrigin(req)).toBe('https://example.com');
  });

  it('ignores an unknown X-Forwarded-Proto', () => {
    const req = fakeRequest({
      host: 'localhost:7400',
      'x-forwarded-proto': 'javascript',
    });
    expect(resolveRequestOrigin(req)).toBe('http://localhost:7400');
  });

  it('returns empty origin for a forged Host', () => {
    expect(
      resolveRequestOrigin(fakeRequest({ host: 'evil.com/<script>' })),
    ).toBe('');
    expect(resolveRequestOrigin(fakeRequest({}))).toBe('');
  });
});

describe('buildMcpGetGuideMarkdown', () => {
  it('explains the endpoint with absolute URLs', () => {
    const md = buildMcpGetGuideMarkdown(GUIDE, 'https://example.com', '/mcp');
    expect(md).toContain('# Test MCP');
    expect(md).toContain('You opened https://example.com/mcp with GET');
    expect(md).toContain('"url": "https://example.com/mcp"');
    expect(md).toContain('claude mcp add --transport http odl-test');
    expect(md).toContain('Accept: application/json, text/event-stream');
    expect(md).toContain('1. Read the routing resource.');
    expect(md).toContain(ODL_SKILLS_INSTALL_COMMAND);
    expect(md).toContain('- Live data: https://example.com/query/mcp');
  });

  it('falls back to paths when the origin is unknown', () => {
    const md = buildMcpGetGuideMarkdown(GUIDE, '', '/mcp');
    expect(md).toContain('"url": "/mcp"');
  });
});

describe('respondToMcpGet', () => {
  it('answers a plain GET with a 200 markdown guide', async () => {
    await withApp(async (base) => {
      const res = await fetch(`${base}/mcp`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      expect(res.headers.get('x-robots-tag')).toBe('noindex');
      const body = await res.text();
      expect(body).toContain(`"url": "${base}/mcp"`);
      expect(body).toContain('POST');
    });
  });

  it('answers an SSE GET with 405 and Allow: POST', async () => {
    await withApp(async (base) => {
      const res = await fetch(`${base}/mcp`, {
        headers: { accept: 'text/event-stream' },
      });
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
      expect(await res.json()).toEqual({
        jsonrpc: '2.0',
        error: { code: -32000, message: MCP_GET_NOT_ALLOWED_MESSAGE },
        id: null,
      });
    });
  });
});
