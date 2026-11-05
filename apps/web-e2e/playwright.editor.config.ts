import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';
import { realpathSync } from 'node:fs';
import path from 'node:path';

import { EDITOR_E2E_BASE_URL, EDITOR_E2E_JWT_SECRET } from './src/editor/support/session';

const QUERY_API_STUB_PORT = 7997;
/**
 * Canonical path casing: on Windows `workspaceRoot` can carry a lower-case drive
 * (`c:\…`) while modules resolve as `C:\…` — webpack then bundles Next's router
 * twice and the page dies with "expected layout router to be mounted".
 */
const ROOT = realpathSync.native(workspaceRoot);
const WEB_PORT = 3991;

/**
 * Post editor e2e, isolated from the developer stack: its own `next dev` on 3991
 * with a test-only JWT secret, query-api replaced by a 404 stub (no database),
 * Google places off. Run: `pnpm nx run web-e2e:e2e-editor`.
 * Next.js allows one `next dev` per app directory — stop a running web dev server first.
 */
export default defineConfig({
  testDir: './src/editor',
  globalSetup: './src/editor/support/global-setup.ts',
  outputDir: path.join(ROOT, 'dist/.playwright/apps/web-e2e/editor'),
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: EDITOR_E2E_BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 180_000,
  },
  webServer: [
    {
      command: 'node apps/web-e2e/src/editor/support/query-api-stub.cjs',
      url: `http://127.0.0.1:${QUERY_API_STUB_PORT}/health`,
      cwd: ROOT,
      reuseExistingServer: false,
      env: { EDITOR_E2E_QUERY_API_PORT: String(QUERY_API_STUB_PORT) },
    },
    {
      command: `pnpm exec next dev --webpack -p ${WEB_PORT}`,
      url: EDITOR_E2E_BASE_URL,
      cwd: path.join(ROOT, 'apps/web'),
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        AUTH_JWT_SECRET: EDITOR_E2E_JWT_SECRET,
        QUERY_API_URL: `http://127.0.0.1:${QUERY_API_STUB_PORT}`,
        POST_EDITOR_GOOGLE_PLACES_ENABLED: 'false',
      },
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, testIgnore: /\.mobile\.spec\.ts$/ },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
});
