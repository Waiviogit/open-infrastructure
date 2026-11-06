'use strict';

/**
 * webServer launcher for the instant rig: migrate + seed the test database, then start the built
 * query-api (`dist/apps/query-api/main.js`) with cwd outside the repo root so no developer `.env`
 * is loaded. Database settings come from playwright.instant.config.ts (`INSTANT_DB_ENV`).
 */

const { execFileSync, spawn } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../../../../..');
const QUERY_API_DIST = path.join(ROOT, 'dist/apps/query-api');

async function migrateAndSeed() {
  if (process.env.POSTGRES_DATABASE !== 'test') {
    throw new Error(`instant rig refuses POSTGRES_DATABASE=${process.env.POSTGRES_DATABASE}: use "test"`);
  }
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), 'libs/migrations/src/cli.ts', 'latest'],
    { cwd: ROOT, env: process.env, stdio: 'inherit' },
  );
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  try {
    await client.query(readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
  } finally {
    await client.end();
  }
}

async function main() {
  if (!existsSync(path.join(QUERY_API_DIST, 'main.js'))) {
    throw new Error('dist/apps/query-api/main.js missing: run `pnpm nx run web-e2e:e2e-instant` (builds query-api)');
  }
  await migrateAndSeed();
  const server = spawn(process.execPath, ['main.js'], {
    cwd: QUERY_API_DIST,
    env: process.env,
    stdio: 'inherit',
  });
  const stop = () => server.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
