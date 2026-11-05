import type { Locator, Page } from '@playwright/test';

import { signIn } from './session';

/** Lexical syncs its selection from the DOM on async `selectionchange`; keys need a beat in between. */
const KEY_SETTLE_MS = 150;
const HYDRATION_TIMEOUT_MS = 45_000;

export const SEARCH_OBJECT = {
  object_id: 'e2e-pizza-palace',
  object_type: 'restaurant',
  name: 'E2E Pizza Palace',
  image_url: null,
  parent_name: null,
};

export const YOUTUBE_URL = 'https://www.youtube.com/watch?v=vJgM9oF7siA';

export type EditorPage = {
  page: Page;
  body: Locator;
  /** Top-level blocks of the body as tags (`p`, `table`, `hr`, `video`, `image`, `code`). */
  blocks: () => Promise<string[]>;
  press: (key: string) => Promise<void>;
  type: (text: string) => Promise<void>;
  openInsertMenu: () => Promise<void>;
};

/** Signed-in `/editor` with `/api/search` mocked to one object; waits for React hydration. */
export async function openEditor(page: Page, username = 'e2e-author'): Promise<EditorPage> {
  await signIn(page.context(), username);
  await page.route('**/api/search?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ objects: [SEARCH_OBJECT], users: [] }),
    }),
  );
  await page.route('**/api/search/objects-by-ids', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ objects: [SEARCH_OBJECT] }),
    }),
  );
  const body = page.locator('[contenteditable="true"]').first();
  const hydrated = () =>
    page.waitForFunction(
      () =>
        [...document.querySelectorAll('[contenteditable="true"]')].some((el) =>
          Object.keys(el).some((k) => k.startsWith('__reactProps')),
        ),
      null,
      { timeout: HYDRATION_TIMEOUT_MS },
    );
  await page.goto('/editor');
  // A `next dev` rebuild can reload the page mid-hydration; one fresh load recovers.
  await hydrated().catch(async () => {
    await page.reload();
    await hydrated();
  });

  const settle = () => page.waitForTimeout(KEY_SETTLE_MS);
  return {
    page,
    body,
    blocks: () =>
      body.evaluate((root) =>
        [...root.children].map((el) => {
          const node = el as HTMLElement;
          if (node.dataset['postVideo']) return 'video';
          if (node.dataset['postImage']) return 'image';
          return node.tagName.toLowerCase();
        }),
      ),
    press: async (key) => {
      await page.keyboard.press(key);
      await settle();
    },
    type: async (text) => {
      await page.keyboard.type(text, { delay: 30 });
      await settle();
    },
    openInsertMenu: async () => {
      await page.getByRole('button', { name: 'Open insert menu' }).click();
      await page.getByRole('button', { name: 'Line' }).waitFor();
    },
  };
}
