import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import { configureHttp } from '../configure-http';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Controller('health')
class StubHealthController {
  @Get()
  get(): { status: string } {
    return { status: 'ok' };
  }
}

const RPC_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

describe('knowledge-api MCP routes', () => {
  let app: INestApplication;
  let baseUrl: string;
  const handle = jest.fn(async (_req: Request, res: Response) => {
    res.status(200).json({ jsonrpc: '2.0', id: 1, result: {} });
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController, StubHealthController],
      providers: [{ provide: McpService, useValue: { handle } }],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves MCP POST at the root /mcp', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: RPC_HEADERS,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(200);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('explains the endpoint on a plain GET', async () => {
    const res = await fetch(`${baseUrl}/mcp`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(await res.text()).toContain(`"url": "${baseUrl}/mcp"`);
  });

  it('answers an SSE GET with 405', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      headers: { accept: 'text/event-stream' },
    });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('drops the old /knowledge/mcp path and keeps other routes prefixed', async () => {
    const old = await fetch(`${baseUrl}/knowledge/mcp`, {
      method: 'POST',
      headers: RPC_HEADERS,
      body: '{}',
    });
    expect(old.status).toBe(404);

    const health = await fetch(`${baseUrl}/knowledge/health`);
    expect(health.status).toBe(200);
  });
});
