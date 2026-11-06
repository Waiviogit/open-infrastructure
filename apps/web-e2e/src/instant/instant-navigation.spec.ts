import { instant } from '@next/playwright';
import { expect, test } from '@playwright/test';

import { signIn } from './support/rig';

/**
 * Navigation contracts: under `instant()` (request-time data paused) the destination skeleton
 * must paint, and its data must not be there yet; after release the data streams in.
 * Routes not adopted yet are marked `test.fail()` with the plan step that adopts them — when one
 * starts passing, Playwright reports it and the annotation must be removed.
 */
test.describe('instant navigation', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test('feed Threads → user profile paints the profile skeleton', async ({ page }) => {
    await page.goto('/feed/threads');
    const trigger = page.locator('main a[href="/@alice"]').first();
    await expect(trigger).toBeVisible();

    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading profile"]')).toBeVisible();
      await expect(page.locator('h1', { hasText: 'alice' })).toHaveCount(0);
    });
    await expect(page.locator('h1', { hasText: 'alice' })).toBeVisible();
  });

  // `object/loading.tsx` sits above the blocking object layout, so its skeleton is the route shell.
  // `instant()` waits for the route prefetch itself; whether a real click has that prefetch is the
  // link's prefetch policy (ObjectPageLink) — measured by the verify skill's nav-instant-trace.cjs.
  test('feed Updates → object paints the object skeleton', async ({ page }) => {
    await page.goto('/feed/updates');
    const trigger = page.locator('main li > a[href="/object/cafe-1"]').first();
    await expect(trigger).toBeVisible();

    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading object"]')).toBeVisible();
      await expect(page.locator('h1', { hasText: 'Blue Cafe' })).toHaveCount(0);
    });
    await expect(page.locator('h1', { hasText: 'Blue Cafe' })).toBeVisible();
  });

  test('feed tab Threads → Updates paints the feed skeleton', async ({ page }) => {
    await page.goto('/feed/threads');
    const trigger = page.locator('aside nav[aria-label="Feed sections"] a[href="/feed/updates"]');
    await expect(trigger).toBeVisible();

    const updatesFeed = page.getByTestId('home-updates-feed');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading posts"]')).toBeVisible();
      await expect(updatesFeed).toHaveCount(0);
    });
    await expect(updatesFeed).toBeVisible();
  });

  // Object tabs are buttons (navigateInstant): the shell client overlays the center skeleton while
  // the transition is pending; the tab page then streams its chrome and its cards.
  test('object tab Details → Updates paints the content skeleton', async ({ page }) => {
    await page.goto('/object/cafe-1');
    const trigger = page.locator('nav[aria-label="Object sections"] button', { hasText: 'Updates' });
    await expect(trigger).toBeVisible();

    const updateCards = page.getByText('Transaction:');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading object content"]')).toBeVisible();
      await expect(updateCards).toHaveCount(0);
    });
    await expect(updateCards.first()).toBeVisible();
  });

  // Profile tabs are OptimisticNavLinks: the center overlay paints while the transition is pending;
  // the tab's own segment (loading.tsx, left-rail slot) streams behind it.
  test('profile tab Posts → Threads paints the content skeleton', async ({ page }) => {
    await page.goto('/@alice');
    const trigger = page.locator('main a[href="/@alice/threads"]:visible').first();
    await expect(trigger).toBeVisible();

    const aliceThread = page.getByText('Great espresso at');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading profile content"]')).toBeVisible();
      await expect(aliceThread).toHaveCount(0);
    });
    await expect(aliceThread).toBeVisible();
  });
});
