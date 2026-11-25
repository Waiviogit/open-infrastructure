function baseUrl(): string {
  const url = process.env.E2E_BASE_URL;
  if (!url) {
    throw new Error('E2E_BASE_URL is not set (check test-setup.ts)');
  }
  return url;
}

describe('GET /mcp — explains the endpoint', () => {
  it('answers a plain GET with a markdown guide', async () => {
    const res = await fetch(`${baseUrl()}/mcp`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('ODL Knowledge MCP server');
    expect(body).toContain(`"url": "${baseUrl()}/mcp"`);
    expect(body).toContain('odl-knowledge://routing');
  });

  it('answers an SSE GET with 405 and Allow: POST', async () => {
    const res = await fetch(`${baseUrl()}/mcp`, {
      headers: { accept: 'text/event-stream' },
    });

    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    const rpc = (await res.json()) as { error?: { message?: string } };
    expect(rpc.error?.message).toContain('POST');
  });

  it('no longer serves the old /knowledge/mcp path', async () => {
    const res = await fetch(`${baseUrl()}/knowledge/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(res.status).toBe(404);
  });
});
