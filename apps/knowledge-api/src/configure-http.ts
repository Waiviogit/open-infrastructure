import { RequestMethod, type INestApplication } from '@nestjs/common';
import { KNOWLEDGE_MCP_PATH } from './constants/mcp';

export const KNOWLEDGE_GLOBAL_PREFIX = 'knowledge';

/** HTTP surface shared by bootstrap and tests: MCP at `/mcp`, everything else under `/knowledge`. */
export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix(KNOWLEDGE_GLOBAL_PREFIX, {
    exclude: [{ path: KNOWLEDGE_MCP_PATH, method: RequestMethod.ALL }],
  });
  app.enableCors({ origin: true });
}
