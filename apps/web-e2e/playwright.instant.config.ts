import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';
import { realpathSync } from 'node:fs';
import path from 'node:path';

import {
  INSTANT_BASE_URL,
  INSTANT_DB_ENV,
  INSTANT_JWT_SECRET,
  INSTANT_QUERY_API_PORT,
  INSTANT_QUERY_API_URL,
  INSTANT_WEB_PORT,
} from './src/instant/support/rig';

/** Canonical path casing on Windows (see playwright.editor.config.ts). */
const ROOT = realpathSync.native(workspaceRoot);
const BUILD_AND_START_TIMEOUT_MS = 900_000;

/**
 * Production `instant()` suite — rig: apps/web-e2e/instant-nav.rig.md.
 * Needs the test database (`pnpm test:db:up`) and a built query-api (`nx run web-e2e:e2e-instant`
 * builds it). The web server is `next build` with the Instant Navigation testing API, then
 * `next start`: prefetching only runs in production.
 */
export default defineConfig({
  testDir: './src/instant',
  outputDir: path.join(ROOT, 'dist/.playwright/apps/web-e2e/instant'),
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: INSTANT_BASE_URL,
    trace: 'retain-on-failure',
    navigationTimeout: 60_000,
  },
  webServer: [
    {
      // Migrates + seeds the test database, then starts dist/apps/query-api outside the repo root.
      command: 'node apps/web-e2e/src/instant/support/start-query-api.cjs',
      url: `${INSTANT_QUERY_API_URL}/query/v1/discover/users?limit=1`,
      cwd: ROOT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...INSTANT_DB_ENV,
        JWT_SECRET: INSTANT_JWT_SECRET,
        PORT: String(INSTANT_QUERY_API_PORT),
      },
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${INSTANT_WEB_PORT}`,
      url: INSTANT_BASE_URL,
      cwd: path.join(ROOT, 'apps/web'),
      reuseExistingServer: false,
      timeout: BUILD_AND_START_TIMEOUT_MS,
      env: {
        EXPOSE_TESTING_API: '1',
        AUTH_JWT_SECRET: INSTANT_JWT_SECRET,
        QUERY_API_URL: INSTANT_QUERY_API_URL,
        WEB_PUBLIC_ORIGIN: INSTANT_BASE_URL,
      },
    },
  ],
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
});
