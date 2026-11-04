import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { waitForPortOpen } from '@nx/node/utils';

import {
  E2E_HOST,
  E2E_JWT_SECRET,
  resolveE2ePort,
  resolveE2eRedisUri,
} from './e2e-env';

declare global {
  var __QUERY_API_PROC__: ChildProcess | undefined;
}

const TEST_POSTGRES_DEFAULT_URL = 'postgres://test:test@127.0.0.1:55432/test';

/** Server env with no dev `.env` leaking in: inherited POSTGRES_* / REDIS_* / JWT_* are dropped. */
function buildServerEnv(postgresUrl: string, port: number): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(POSTGRES_|REDIS_|JWT_)/.test(key),
    ),
  );
  const url = new URL(postgresUrl);
  return {
    ...inherited,
    NODE_ENV: 'test',
    PORT: String(port),
    JWT_SECRET: E2E_JWT_SECRET,
    REDIS_URI: resolveE2eRedisUri(),
    POSTGRES_HOST: url.hostname,
    POSTGRES_PORT: url.port || '5432',
    POSTGRES_DATABASE: url.pathname.replace(/^\//, ''),
    POSTGRES_USER: decodeURIComponent(url.username),
    POSTGRES_PASSWORD: decodeURIComponent(url.password),
  };
}

module.exports = async function () {
  const repoRoot = join(__dirname, '../../../..');
  const postgresUrl = process.env['POSTGRES_TEST_URL']?.trim() || TEST_POSTGRES_DEFAULT_URL;
  process.env['POSTGRES_TEST_URL'] = postgresUrl;

  const prepared = spawnSync(
    process.execPath,
    [
      join(repoRoot, 'node_modules/tsx/dist/cli.mjs'),
      '--tsconfig',
      join(repoRoot, 'tsconfig.base.json'),
      join(__dirname, 'prepare-test-db.ts'),
    ],
    { cwd: repoRoot, env: process.env, stdio: 'inherit' },
  );
  if (prepared.status !== 0) {
    throw new Error('query-api-e2e: test database is not ready (see output above)');
  }

  const distDir = join(repoRoot, 'dist/apps/query-api');
  const mainJs = join(distDir, 'main.js');
  if (!existsSync(mainJs)) {
    throw new Error(`query-api-e2e: ${mainJs} not found — run pnpm nx build query-api`);
  }

  const port = resolveE2ePort();
  // cwd is the dist folder: ConfigModule looks for `.env` relative to cwd, so no dev `.env` is read.
  const child = spawn(process.execPath, [mainJs], {
    cwd: distDir,
    env: buildServerEnv(postgresUrl, port),
    stdio: 'inherit',
  });
  globalThis.__QUERY_API_PROC__ = child;

  await waitForPortOpen(port, { host: E2E_HOST });
};
