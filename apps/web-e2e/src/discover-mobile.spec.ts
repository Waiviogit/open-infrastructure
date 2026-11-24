import { expect, test } from '@playwright/test';

const MOCK_DISCOVER_OBJECT = {
  object_id: 'e2e-discover-restaurant',
  object_type: 'restaurant',
  semantic_type: null,
  weight: 1.5,
  fields: {
    name: 'E2E Discover Restaurant',
    description: 'Test restaurant for discover mobile',
  },
  isFavorited: false,
  hasSupervisedOwnership: false,
  hasExclusiveOwnership: false,
};

const MOCK_TAG_CATEGORIES = {
  categories: [
    {
      category: 'Cuisine',
      items: [{ value: 'Sushi', count: 3 }],
    },
  ],
};

test.describe('Discover mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    await page.route('**/api/discover/objects**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [MOCK_DISCOVER_OBJECT],
          cursor: null,
          hasMore: false,
        }),
      });
    });

    await page.route('**/api/discover/tag-categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TAG_CATEGORIES),
      });
    });
  });

  test('defaults first-time visitor to product', async ({ page }) => {
    await page.goto('/discover');

    await expect(page).toHaveURL(/type=product/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Object types' }).getByRole('link', { name: 'Product' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('skips picker for returning visitor with remembered type cookie', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'discover_object_type',
        value: 'restaurant',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/discover');

    await expect(page).toHaveURL(/type=restaurant/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('applies mobile filter and browser back removes it', async ({ page }) => {
    await page.goto('/discover?type=restaurant');

    await page.getByRole('button', { name: 'Filter' }).click();
    const filterSheet = page.getByRole('dialog');
    await expect(filterSheet).toBeVisible();

    await filterSheet.getByRole('checkbox', { name: /Sushi/i }).click();
    await expect(page).toHaveURL(/tags=Cuisine(%3A|:)Sushi/, { timeout: 15_000 });

    await filterSheet.getByRole('button', { name: 'Show results' }).click();
    await expect(filterSheet).toBeHidden();
    await expect(page.getByRole('button', { name: 'Remove filter Cuisine: Sushi' })).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/tags=/);
  });
});

test.describe('Discover desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/discover/objects**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [MOCK_DISCOVER_OBJECT],
          cursor: null,
          hasMore: false,
        }),
      });
    });

    await page.route('**/api/discover/tag-categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TAG_CATEGORIES),
      });
    });
  });

  test('shows three-column layout without mobile sheets', async ({ page }) => {
    await page.goto('/discover?type=restaurant');

    await expect(page.getByRole('heading', { name: 'Discover', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filters', level: 2 })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('E2E Discover Restaurant')).toBeVisible();
  });

  test('defaults to product and shows the type menu: popular types, Users, More', async ({
    page,
  }) => {
    await page.goto('/discover');

    await expect(page).toHaveURL(/type=product/);
    const menu = page.getByRole('navigation', { name: 'Object types' });
    await expect(menu.getByRole('link', { name: 'Product' })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Business', 'Restaurant', 'Person', 'Book', 'Users']) {
      await expect(menu.getByRole('link', { name })).toBeVisible();
    }
    await expect(menu.getByRole('button', { name: /More/ })).toBeVisible();
  });

  test('a type picked from More becomes an active tab', async ({ page }) => {
    await page.goto('/discover?type=product');

    const menu = page.getByRole('navigation', { name: 'Object types' });
    await menu.getByRole('button', { name: /More/ }).click();
    await page.getByRole('searchbox', { name: 'Search object types' }).fill('reci');
    const more = page.getByRole('navigation', { name: 'More object types' });
    await more.getByRole('link', { name: 'Recipe' }).click();

    await expect(page).toHaveURL(/type=recipe/);
    await expect(menu.getByRole('link', { name: 'Recipe' })).toHaveAttribute('aria-current', 'page');
    await expect(more).toHaveCount(0);
  });
});
