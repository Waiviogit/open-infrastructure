import { expect, test } from '@playwright/test';

import { openEditor, SEARCH_OBJECT } from './support/editor-page';

test.describe('post editor # object search', () => {
  test('# shows our objects only and inserts the picked object as a link', async ({ page }) => {
    const placesCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/places')) {
        placesCalls.push(request.url());
      }
    });
    const editor = await openEditor(page);

    await editor.body.click();
    await editor.type('Dinner at #');
    await expect(page.getByRole('status').filter({ hasText: 'Find an object' })).toBeVisible();

    await editor.type('pizza');
    const menu = page.getByRole('listbox', { name: 'Search objects and places' });
    await expect(menu.getByText('Objects', { exact: true })).toBeVisible();
    await expect(menu.getByText('Google Maps nearby')).toHaveCount(0);

    await menu.getByRole('option', { name: new RegExp(SEARCH_OBJECT.name) }).click();

    const link = editor.body.getByRole('link', { name: SEARCH_OBJECT.name });
    await expect(link).toHaveAttribute('href', new RegExp(`/object/${SEARCH_OBJECT.object_id}$`));
    await expect(editor.body).not.toContainText('#pizza');
    await expect(page.getByText('Linked objects')).toBeVisible();
    expect(placesCalls).toEqual([]);
  });
});
