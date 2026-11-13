import { instant } from '@next/playwright';
import { expect, test } from '@playwright/test';

import { signIn } from './support/rig';

/**
 * Navigation contracts: under `instant()` (request-time data paused) the destination skeleton
 * must paint, and its data must not be there yet; after release the data streams in.
 * A contract that cannot pass yet is marked `test.fail()` with the step that fixes it — when it
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
    const trigger = page.locator('nav[aria-label="Feed sections"] a[href="/feed/updates"]');
    await expect(trigger).toBeVisible();

    const updatesFeed = page.getByTestId('home-updates-feed');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading posts"]')).toBeVisible();
      await expect(updatesFeed).toHaveCount(0);
    });
    await expect(updatesFeed).toBeVisible();
  });

  // The rail filter is shared by every tab: the tab links carry it, and a tab that cannot
  // apply it (Activity has no ranking) explains the fallback to New.
  test('feed tabs keep the rail filter; Activity explains an unavailable sort', async ({ page }) => {
    await page.goto('/feed/threads?filter=hot');
    const activityTab = page.locator('nav[aria-label="Feed sections"] a[href="/feed/activity?filter=hot"]');
    await expect(activityTab).toBeVisible();

    await activityTab.click();
    await expect(page).toHaveURL(/\/feed\/activity\?filter=hot$/);
    await expect(page.getByRole('status')).toContainText('is not available on this tab');
    // Each tab shows only its own sorts: Activity has New (and My feed), no Trending / Hot.
    // Role queries only: the previous tab's rail (with Hot) stays in the DOM as a hidden
    // `<Activity>` for instant Back, and text queries would count it.
    const rail = page.locator('aside nav[aria-label="Feed filters"]');
    await expect(rail.getByRole('link', { name: 'New' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Hot' })).toHaveCount(0);
    await expect(rail.getByRole('link', { name: 'Trending' })).toHaveCount(0);
  });

  // Hub section tabs prefetch their shells (`prefetchShell`). Bare `/discover` is redirected to
  // `?type=` in proxy.ts; the shell is `discover/loading.tsx`.
  test('header → Discover paints the discover skeleton', async ({ page }) => {
    await page.goto('/feed/threads');
    const trigger = page.locator('nav[aria-label="Main sections"] a[href="/discover"]');
    await expect(trigger).toBeVisible();

    const discoverHeading = page.locator('h1', { hasText: 'Discover' });
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading discover"]')).toBeVisible();
      await expect(discoverHeading).toHaveCount(0);
    });
    await expect(discoverHeading).toBeVisible();
    await expect(page).toHaveURL(/\/discover\?type=/);
  });

  // `business/loading.tsx` is shared by both tabs, so each page streams its body behind its own
  // `<Suspense fallback={<BusinessContentSkeleton/>}>`.
  test('business Offers → Requests paints the business skeleton', async ({ page }) => {
    await page.goto('/business/offers');
    const trigger = page.locator('a[href="/business/requests"]');
    await expect(trigger).toBeVisible();

    // `:visible` — Next keeps the previous route (same nav) hidden in the DOM.
    const businessNav = page.locator('nav[aria-label="Business navigation"]:visible');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading business"]')).toBeVisible();
      await expect(businessNav).toHaveCount(0);
    });
    await expect(businessNav).toBeVisible();
  });

  // Signed-in routes: proxy.ts sends the anonymous 307, so pages read the user behind their tab
  // segment's own loading.tsx (the shared `manage/offers` segment does not change on tab switches).
  test('business manage Drafts → Published paints the list skeleton', async ({ page }) => {
    await page.goto('/business/manage/offers/drafts');
    const trigger = page.locator('a[href="/business/manage/offers/published"]');
    await expect(trigger).toBeVisible();

    const businessNav = page.locator('nav[aria-label="Business navigation"]:visible');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading offers"]')).toBeVisible();
      await expect(businessNav).toHaveCount(0);
    });
    await expect(businessNav).toBeVisible();
  });

  test('tools Notification settings → Drafts paints the drafts skeleton', async ({ page }) => {
    await page.goto('/notifications/settings');
    const trigger = page.locator('a[href="/drafts"]');
    await expect(trigger).toBeVisible();

    const draftsHeading = page.locator('h1:visible', { hasText: /^Drafts$/ });
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading drafts"]')).toBeVisible();
      await expect(draftsHeading).toHaveCount(0);
    });
    await expect(draftsHeading).toBeVisible();
  });

  // Settings reads nothing per request (title via useI18n), so the page itself is the static shell.
  test('tools → Settings paints the page from the static shell', async ({ page }) => {
    await page.goto('/notifications/settings');
    const trigger = page.locator('a[href="/settings"]');
    await expect(trigger).toBeVisible();

    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('h1:visible', { hasText: /^Settings$/ })).toBeVisible();
    });
  });

  // The editor screen is client-heavy: `editor/loading.tsx` paints a centered loader while the page
  // reads the session and the draft list.
  test('header Write post → editor paints the editor loader', async ({ page }) => {
    await page.goto('/feed/threads');
    const trigger = page.locator('header a[href="/editor"]');
    await expect(trigger).toBeVisible();

    const editorBody = page.locator('[contenteditable="true"]');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading editor"]')).toBeVisible();
      await expect(editorBody).toHaveCount(0);
    });
    await expect(editorBody.first()).toBeVisible();
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

  // Soft navigation to a post is intercepted by `@modal`; its page renders the post behind
  // `<Suspense fallback={<ModalLoadingSkeleton/>}>`, so the modal skeleton is the route shell.
  test('profile blog → post opens the post modal skeleton', async ({ page }) => {
    await page.goto('/@alice');
    const trigger = page.locator('main a[href="/@alice/espresso-review"]').first();
    await expect(trigger).toBeVisible();

    const postDialog = page.getByRole('dialog');
    await instant(page, async () => {
      await trigger.click();
      await expect(page.locator('[aria-label="Loading post"]')).toBeVisible();
      await expect(postDialog).toHaveCount(0);
    });
    await expect(postDialog.getByText('rich and balanced')).toBeVisible();
  });
});
