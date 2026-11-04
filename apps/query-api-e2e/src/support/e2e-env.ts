/**
 * Single source of the query-api e2e endpoints. The server under test is the built
 * `dist/apps/query-api/main.js`, started by global setup against the disposable `test`
 * Postgres and the `redis-test` service from docker-compose.test.yml — never the dev stack.
 */
export const E2E_HOST = '127.0.0.1';
export const E2E_DEFAULT_PORT = 7990;
export const E2E_DEFAULT_REDIS_URI = 'redis://127.0.0.1:56379';
export const E2E_JWT_SECRET = 'query-api-e2e-only';

export function resolveE2ePort(): number {
  const raw = process.env['QUERY_API_E2E_PORT'];
  const port = raw ? Number(raw) : E2E_DEFAULT_PORT;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid QUERY_API_E2E_PORT: ${raw}`);
  }
  return port;
}

export function resolveE2eBaseUrl(): string {
  return `http://${E2E_HOST}:${resolveE2ePort()}`;
}

export function resolveE2eRedisUri(): string {
  return process.env['REDIS_TEST_URI']?.trim() || E2E_DEFAULT_REDIS_URI;
}
