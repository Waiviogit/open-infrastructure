import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

describe('query-api MCP GET', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [{ provide: McpService, useValue: { handle: jest.fn() } }],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same prefix and versioning as main.ts.
    app.setGlobalPrefix('query');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('explains the endpoint on a plain GET', async () => {
    const res = await fetch(`${baseUrl}/query/mcp`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('ODL Query MCP server');
    expect(body).toContain(`"url": "${baseUrl}/query/mcp"`);
    expect(body).toContain(`${baseUrl}/mcp`);
  });

  it('answers an SSE GET with 405 and Allow: POST', async () => {
    const res = await fetch(`${baseUrl}/query/mcp`, {
      headers: { accept: 'text/event-stream' },
    });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });
});
