import { expect, test, type Page } from '@playwright/test';

import { openEditor, type EditorPage } from './support/editor-page';
import { signIn } from './support/session';

const POST_PATH = '/@e2e-author/e2e-rich-post';
const ORIGINAL_IMAGE_URL = 'https://example.com/e2e-rich-post.jpg';
const PASTE_SETTLE_MS = 1_000;

/** Every block of the fixture post (`support/rich-post-fixture.cjs`), in order. */
const POST_BLOCKS = [
  'h2',
  'p',
  'image',
  'ul',
  'ol',
  'blockquote',
  'p',
  'code',
  'table',
  'hr',
  'video',
  'p',
];

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Media never loads in the isolated suite; the markup is what is under test.
  await page.route(/youtube\.com|example\.com/, (route) => route.abort());
});

/** Selects the whole post body and copies it with the keyboard, as a reader would. */
async function copyPostBody(page: Page): Promise<void> {
  const body = page.locator('.blog-post-body').last();
  await expect(body).toContainText('Closing paragraph.');
  await body.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  await page.keyboard.press('Control+C');
}

async function pasteIntoEditor(editor: EditorPage): Promise<void> {
  await editor.body.click();
  await editor.page.keyboard.press('Control+V');
  await editor.page.waitForTimeout(PASTE_SETTLE_MS);
}

async function expectRichPost(editor: EditorPage): Promise<void> {
  await expect.poll(editor.blocks).toEqual(POST_BLOCKS);
  const { body } = editor;
  await expect(body.locator('h2')).toHaveText('Section heading');
  await expect(body.locator('strong')).toHaveText('bold words');
  await expect(body.locator('em')).toHaveText('italic words');
  await expect(body.locator('.line-through')).toHaveText('struck words');
  await expect(body.locator('a[href="https://example.com/docs"]')).toHaveText(
    'docs link',
  );
  await expect(body.locator('[data-post-image] img')).toHaveAttribute(
    'src',
    ORIGINAL_IMAGE_URL,
  );
  await expect(body.locator('[data-post-video] iframe')).toHaveAttribute(
    'src',
    /youtube\.com\/embed\/vJgM9oF7siA/,
  );
  await expect(body.locator('table td')).toHaveText(['alpha', '1']);
  await expect(body.locator(':scope > code')).toHaveText('const answer = 42;');
}

test('a post copied from its full page pastes with the same blocks and formatting', async ({
  page,
  context,
}) => {
  await signIn(context, 'e2e-author');
  await page.goto(POST_PATH);
  await copyPostBody(page);

  const editor = await openEditor(page);
  await pasteIntoEditor(editor);
  await expectRichPost(editor);
});

test('a post copied from the post modal pastes with the same blocks and formatting', async ({
  page,
}) => {
  const editor = await openEditor(page);
  // Soft navigation from inside the app opens the intercepting post modal.
  await page.evaluate((path) => {
    (
      window as unknown as {
        next: { router: { push: (href: string) => void } };
      }
    ).next.router.push(path);
  }, POST_PATH);
  await expect(page.getByRole('dialog')).toBeVisible();
  await copyPostBody(page);
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();

  await pasteIntoEditor(editor);
  await expectRichPost(editor);
});

test('copied text with an image link inside keeps all its text', async ({
  page,
}) => {
  const editor = await openEditor(page);
  await page.evaluate(async (url) => {
    const html = `<p>Look at <a href="${url}">${url}</a> and <strong>more</strong></p>`;
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([`Look at ${url} and more`], {
          type: 'text/plain',
        }),
      }),
    ]);
  }, ORIGINAL_IMAGE_URL);

  await pasteIntoEditor(editor);
  await expect.poll(editor.blocks).toEqual(['p']);
  await expect(editor.body).toContainText(
    `Look at ${ORIGINAL_IMAGE_URL} and more`,
  );
  await expect(editor.body.locator('strong')).toHaveText('more');
});
