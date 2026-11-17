'use strict';

/**
 * Drives /object/pinv-drink as `vic` (seeded by object-post-pin-remove.scenario.ts):
 * pinned badges + order, ⋯ menu Pin / Unpin / Remove, Remove confirm dialog, REVIEWS edit group.
 * Wallet broadcasts are not driven (they would hit the chain): the dialog is cancelled.
 * Usage: node object-post-pin-remove.web.cjs <screenshotDir>
 */
const path = require('path');
const { launch, openAs } = require('../web-session.cjs');

const OUT = process.argv[2] ?? '.';
const OBJECT_PATH = '/object/pinv-drink/social';

async function cards(page) {
  return page.$$eval('main article:visible', (articles) =>
    articles.map((a) => ({
      title: a.querySelector('h2, h3')?.textContent?.trim() ?? '',
      pinned: /Pinned/.test(a.querySelector('header')?.textContent ?? ''),
    })),
  );
}

async function menuItems(page, title) {
  const card = page.locator('main article:visible', { hasText: title }).first();
  await card.getByRole('button', { name: 'Post actions' }).click();
  const items = await card.getByRole('menuitem').allTextContents();
  return { card, items: items.map((s) => s.trim()) };
}

(async () => {
  const browser = await launch();
  try {
    const { page, status } = await openAs(browser, 'vic', OBJECT_PATH, {
      hydrate: 'button[aria-haspopup="menu"]',
    });
    console.log('status', status);
    console.log('cards', JSON.stringify(await cards(page), null, 0));
    await page.screenshot({ path: path.join(OUT, 'pin-feed.png'), fullPage: true });

    const pinnedByVic = await menuItems(page, 'Kopi Talua review 1');
    console.log('menu review 1 (vic pinned):', pinnedByVic.items.slice(0, 3));
    await page.screenshot({ path: path.join(OUT, 'pin-menu-unpin.png') });
    await page.keyboard.press('Escape');

    const notPinned = await menuItems(page, 'Kopi Talua review 8');
    console.log('menu review 8 (not pinned):', notPinned.items.slice(0, 3));
    await notPinned.card.getByRole('menuitem', { name: 'Remove' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    console.log('remove dialog:', (await dialog.textContent())?.replace(/\s+/g, ' ').trim());
    await page.screenshot({ path: path.join(OUT, 'pin-remove-dialog.png') });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    console.log('dialog closed:', (await page.getByRole('dialog').count()) === 0);

    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    // The edit rail renders in both the desktop and the mobile column; take the visible one.
    const reviews = page.locator('h3#object-edit-group-reviews:visible').first();
    await reviews.waitFor({ timeout: 30_000 });
    await reviews.scrollIntoViewIfNeeded();
    const group = await reviews.evaluate((el) =>
      el.parentElement?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200),
    );
    console.log('REVIEWS group text:', group);
    await page.screenshot({ path: path.join(OUT, 'pin-edit-rail.png') });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
