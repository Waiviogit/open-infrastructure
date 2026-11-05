import { expect, test } from '@playwright/test';

import { openEditor, YOUTUBE_URL } from './support/editor-page';

test.describe('post editor blocks', () => {
  test('table: 2×2 insert, toolbar adds rows / columns and removes the table', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.click();
    await editor.openInsertMenu();
    await page.getByRole('button', { name: 'Table' }).click();

    const table = editor.body.locator('table');
    await expect(table.locator('tr')).toHaveCount(2);
    await expect(table.locator('tr').first().locator('td, th')).toHaveCount(2);

    const toolbar = page.getByRole('toolbar', { name: 'Block actions' });
    await toolbar.getByRole('button', { name: '+ Row' }).click();
    await expect(table.locator('tr')).toHaveCount(3);
    await toolbar.getByRole('button', { name: '+ Column' }).click();
    await expect(table.locator('tr').first().locator('td, th')).toHaveCount(3);

    await toolbar.getByRole('button', { name: 'Remove table' }).click();
    await expect(editor.body.locator('table')).toHaveCount(0);
    await expect(toolbar).toHaveCount(0);
  });

  test('table: the line below it cannot be lost and ArrowDown leaves the table', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.click();
    await editor.openInsertMenu();
    await page.getByRole('button', { name: 'Table' }).click();
    expect((await editor.blocks()).at(-1)).toBe('p');

    // Delete the line under the table: the caret goes into the table, the line comes back.
    await editor.body.locator(':scope > p').last().click();
    await editor.press('Backspace');
    expect((await editor.blocks()).at(-1)).toBe('p');

    await editor.body.locator('table tr').last().locator('td, th').first().click();
    await editor.press('ArrowDown');
    await editor.type('below');
    await expect(editor.body.locator(':scope > p').last()).toHaveText('below');
  });

  test('line at the start: ArrowUp selects it, then opens a text line above', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.click();
    await editor.openInsertMenu();
    await page.getByRole('button', { name: 'Line' }).click();
    expect(await editor.blocks()).toEqual(['hr', 'p']);

    await editor.press('ArrowUp');
    await expect(editor.body.locator('hr')).toHaveAttribute('data-image-selected', '');

    await editor.press('ArrowUp');
    await editor.type('above');
    expect(await editor.blocks()).toEqual(['p', 'hr', 'p']);
    await expect(editor.body.locator(':scope > p').first()).toHaveText('above');
  });

  test('video: the inline link field embeds a player in the body', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.click();
    await editor.openInsertMenu();
    await page.getByRole('button', { name: 'Video' }).click();

    const field = page.getByPlaceholder('Paste video link and press Enter');
    await field.fill(YOUTUBE_URL);
    await field.press('Enter');

    const player = editor.body.locator('[data-post-video] iframe');
    await expect(player).toHaveAttribute('src', /youtube(-nocookie)?\.com\/embed\/vJgM9oF7siA/);
    expect(await editor.blocks()).toContain('video');
  });

  test('video: a non-video link shows an error and inserts nothing', async ({ page }) => {
    const editor = await openEditor(page);
    await editor.body.click();
    await editor.openInsertMenu();
    await page.getByRole('button', { name: 'Video' }).click();

    const field = page.getByPlaceholder('Paste video link and press Enter');
    await field.fill('https://example.com/article');
    await field.press('Enter');

    await expect(
      page.getByRole('alert').filter({ hasText: 'Paste a YouTube, Instagram, TikTok' }),
    ).toBeVisible();
    await expect(editor.body.locator('[data-post-video]')).toHaveCount(0);
  });
});
