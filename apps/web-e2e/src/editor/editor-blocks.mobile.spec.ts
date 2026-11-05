import { expect, test } from '@playwright/test';

import { openEditor } from './support/editor-page';

test.describe('post editor on a phone', () => {
  test('block toolbar gives a touch way out of a table and stays on screen', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.tap();
    await page.getByRole('button', { name: 'Open insert menu' }).tap();
    await page.getByRole('button', { name: 'Table' }).tap();

    await editor.body.locator('table td, table th').first().tap();
    const toolbar = page.getByRole('toolbar', { name: 'Block actions' });
    await expect(toolbar).toBeVisible();
    const box = await toolbar.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(box && box.x >= 0 && box.x + box.width <= viewportWidth).toBe(true);

    await toolbar.getByRole('button', { name: '↑ Line' }).tap();
    await editor.type('Intro');

    const blocks = await editor.blocks();
    expect(blocks.indexOf('table')).toBeGreaterThan(0);
    await expect(editor.body.locator(':scope > p').filter({ hasText: 'Intro' })).toHaveCount(1);
    const intro = await editor.body
      .locator(':scope > *')
      .evaluateAll((els) => els.findIndex((el) => el.textContent === 'Intro'));
    expect(intro).toBe(blocks.indexOf('table') - 1);
  });

  test('the editor page has no horizontal scroll and the (+) stays inside the screen', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.tap();

    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.scroll).toBe(widths.viewport);

    const plus = await page.getByRole('button', { name: 'Open insert menu' }).boundingBox();
    expect(plus && plus.x >= 0).toBe(true);
  });
});
