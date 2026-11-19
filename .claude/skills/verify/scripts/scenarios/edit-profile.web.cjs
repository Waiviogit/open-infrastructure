'use strict';

/**
 * Drives /edit-profile as `hiveio` (seeded by edit-profile.scenario.ts; the form prefills from the live chain).
 * A fake `window.hive_keychain` records what the app asks Keychain to sign and answers with a fake trx id, so
 * nothing reaches the chain. Flow: anonymous 307 → own profile header "Edit profile" → menu item active,
 * prefill → invalid wallet error → change location + Instagram + signature → Save (captures account_update2)
 * → back on the profile → client-side navigation to a post → new reply (captures the signed body).
 * Usage: node edit-profile.web.cjs <outDir>   (writes captured-ops.json + screenshots to outDir)
 */
const fs = require('fs');
const path = require('path');
const { BASE_URL, launch, openAs } = require('../web-session.cjs');

const OUT = process.argv[2] ?? '.';
const VIEWER = 'hiveio';
const POST_PATH = '/@bob/edit-profile-post';
const SIGNATURE = 'Signed by verify';
const CAPTURE_TIMEOUT_MS = 60_000;

const FAKE_KEYCHAIN = () => {
  window.__capturedOps = window.__capturedOps ?? [];
  window.hive_keychain = {
    requestBroadcast(account, operations, key, callback) {
      window.__capturedOps.push({ account, operations, key });
      setTimeout(() => callback({ success: true, result: { id: 'f'.repeat(40) } }), 0);
    },
    requestHandshake(callback) {
      callback?.();
    },
    // The app detects the extension by this method (is-keychain-extension-available.ts).
    requestSignBuffer(_account, _message, _key, callback) {
      callback?.({ success: false, error: 'not used in verification' });
    },
  };
};

async function capturedCount(page) {
  return page.evaluate(() => window.__capturedOps.length);
}

(async () => {
  const anon = await fetch(`${BASE_URL}/edit-profile`, { redirect: 'manual' });
  console.log('anonymous /edit-profile:', anon.status, anon.headers.get('location'));

  const browser = await launch();
  try {
    const { page, status } = await openAs(browser, VIEWER, `/@${VIEWER}`, { hydrate: 'a[href="/edit-profile"]' });
    console.log('profile status', status);
    await page.addInitScript(FAKE_KEYCHAIN);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.hive_keychain?.requestBroadcast === 'function');
    await page.waitForFunction(
      () => [...document.querySelectorAll('a[href="/edit-profile"]')].some((el) => Object.keys(el).some((k) => k.startsWith('__reactProps'))),
      undefined,
      { timeout: 120_000 },
    );

    await page.locator('a[href="/edit-profile"]:visible', { hasText: 'Edit profile' }).first().click();
    await page.waitForURL('**/edit-profile', { timeout: 120_000 });
    const nameInput = page.locator('#profile-name');
    await nameInput.waitFor({ timeout: 120_000 });
    await page.waitForFunction(
      () => Object.keys(document.querySelector('#profile-name') ?? {}).some((k) => k.startsWith('__reactProps')),
      undefined,
      { timeout: 120_000 },
    );
    console.log('menu active:', await page.locator('nav a[aria-current="page"]').allTextContents());
    const prefill = await page.$$eval('form input, form textarea', (els) =>
      els.filter((el) => el.value).map((el) => `${el.id || el.placeholder}=${el.value.slice(0, 60)}`),
    );
    console.log('prefilled:', prefill);
    console.log('save disabled before edit:', await page.getByRole('button', { name: 'Save' }).isDisabled());
    await page.screenshot({ path: path.join(OUT, 'edit-profile-prefill.png'), fullPage: true });

    const ethereum = page.getByPlaceholder('Ethereum', { exact: true });
    await ethereum.fill('0x123');
    console.log('invalid ethereum error:', await page.locator('#profile-ethereum-error').textContent());
    console.log('save disabled with error:', await page.getByRole('button', { name: 'Save' }).isDisabled());
    await ethereum.fill('');

    await page.locator('#profile-location').fill('Verify City');
    await page.getByPlaceholder('Instagram', { exact: true }).fill('@verify_handle');
    const editor = page.locator('form [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(SIGNATURE);
    await page.getByText(SIGNATURE, { exact: true }).nth(1).waitFor({ timeout: 10_000 });
    console.log('signature preview shown: true');
    await page.screenshot({ path: path.join(OUT, 'edit-profile-changed.png'), fullPage: true });

    await page.getByRole('button', { name: 'Save' }).click();
    try {
      await page.waitForFunction(() => window.__capturedOps.length >= 1, undefined, { timeout: CAPTURE_TIMEOUT_MS });
    } catch (error) {
      console.log('no keychain call; alerts:', await page.getByRole('alert').allTextContents());
      console.log('save button:', await page.locator('button[type="submit"]').textContent());
      await page.screenshot({ path: path.join(OUT, 'edit-profile-save-failed.png'), fullPage: true });
      throw error;
    }
    const [profileCall] = await page.evaluate(() => window.__capturedOps);
    console.log('keychain call:', profileCall.account, profileCall.key, profileCall.operations.map((op) => op[0]));
    const update = profileCall.operations[0][1];
    console.log('json_metadata:', JSON.stringify(update.json_metadata));
    console.log('posting_json_metadata:', update.posting_json_metadata);

    await page.waitForURL(`**/@${VIEWER}`, { timeout: CAPTURE_TIMEOUT_MS });
    console.log('after save url:', page.url());

    await page.evaluate((target) => window.next.router.push(target), POST_PATH);
    await page.waitForURL(`**${POST_PATH}`, { timeout: 120_000 });
    const openComments = page.getByRole('button', { name: 'Comments', exact: true }).first();
    await openComments.waitFor({ timeout: 120_000 });
    await openComments.click();
    const reply = page.getByRole('button', { name: 'Submit comment' }).first();
    await reply.waitFor({ timeout: 120_000 });
    const commentEditor = page.locator('[contenteditable="true"]').last();
    await commentEditor.click();
    await page.keyboard.type('Nice post');
    await page.waitForFunction(
      () => [...document.querySelectorAll('button[aria-label="Submit comment"]')].some((b) => !b.disabled),
      undefined,
      { timeout: 10_000 },
    );
    const before = await capturedCount(page);
    await page.locator('button[aria-label="Submit comment"]:not([disabled])').first().click();
    await page.waitForFunction((n) => window.__capturedOps.length > n, before, { timeout: CAPTURE_TIMEOUT_MS });
    const calls = await page.evaluate(() => window.__capturedOps);
    const comment = calls[calls.length - 1];
    console.log('comment call:', comment.account, comment.key, comment.operations.map((op) => op[0]));
    console.log('comment body:', JSON.stringify(comment.operations[0][1].body));
    await page.screenshot({ path: path.join(OUT, 'edit-profile-comment.png'), fullPage: true });

    fs.writeFileSync(
      path.join(OUT, 'captured-ops.json'),
      JSON.stringify(calls.flatMap((call) => call.operations), null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
