'use strict';

/**
 * Playwright helpers for driving apps/web as a signed-in user without auth-api:
 * mints an HS256 access JWT (`typ: access`, `sub = username`) with the same AUTH_JWT_SECRET the
 * dev server was started with, sets the `odl_access` cookie, opens the page and waits for React
 * hydration of a given element before returning.
 *
 *   const { launch, openAs } = require('./web-session.cjs');
 *   const browser = await launch();
 *   const page = await openAs(browser, 'carol', '/business/pay?for=alice&to=bob', { hydrate: 'button' });
 *
 * Use http://localhost (not 127.0.0.1) unless next.config allows the origin in `allowedDevOrigins`.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const NODE_MODULES = path.join(REPO, 'node_modules');

function requireFromRepo(id) {
  return require(require.resolve(id, { paths: [NODE_MODULES, path.join(NODE_MODULES, '.pnpm/node_modules')] }));
}

const { chromium } = requireFromRepo('playwright');
const { SignJWT } = requireFromRepo('jose');

const BASE_URL = process.env.VERIFY_WEB_URL ?? 'http://localhost:3991';
const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? 'verify-only-secret-1234';
const NAVIGATION_TIMEOUT_MS = 180_000;
const HYDRATION_TIMEOUT_MS = 120_000;
/** Console noise from services the verification setup does not run. */
const IGNORED_CONSOLE = /_next\/hmr|:7200\/notifications/;

async function accessToken(username) {
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function launch() {
  return chromium.launch();
}

/**
 * @param {import('playwright').Browser} browser
 * @param {string} username
 * @param {string} urlPath
 * @param {{ hydrate?: string }} [options] CSS selector of an element whose React props must be attached
 */
async function openAs(browser, username, urlPath, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'odl_access', value: await accessToken(username), url: BASE_URL }]);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) console.log('  [console.error]', m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 300)));
  const response = await page.goto(BASE_URL + urlPath, { waitUntil: 'networkidle', timeout: NAVIGATION_TIMEOUT_MS });
  if (options.hydrate) {
    await page.waitForFunction(
      (selector) =>
        [...document.querySelectorAll(selector)].some((el) => Object.keys(el).some((k) => k.startsWith('__reactProps'))),
      options.hydrate,
      { timeout: HYDRATION_TIMEOUT_MS },
    );
  }
  return { page, status: response ? response.status() : null };
}

module.exports = { BASE_URL, launch, openAs };
