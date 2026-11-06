'use strict';

/**
 * Frame-by-frame scroll trace for "list → page" navigation.
 * Scrolls a list, clicks a link visible in the viewport, records `scrollY` on every
 * animation frame of the new page, then presses Back and checks the list offset.
 *
 * Usage (web dev/prod server on VERIFY_WEB_URL, default http://localhost:3991):
 *   node .claude/skills/verify/scripts/scroll-entry-trace.cjs <listPath without leading slash> <linkSelector> [scrollY] [username]
 *   node .claude/skills/verify/scripts/scroll-entry-trace.cjs feed/updates 'main li > a[href^="/object/"]' 2500 carol
 *   node .claude/skills/verify/scripts/scroll-entry-trace.cjs feed/threads 'main a[href="/@alice"]' 2500
 *
 * PASS means no frame of the new page painted a skeleton or content off the top, and Back
 * restored the list offset. Prefer a production build (`next build` + `next start`): dev adds
 * compile latency before the skeleton appears.
 */

const { launch, openAs } = require('./web-session.cjs');

const TRACE_MS = 4000;
const LIST_GROW_ATTEMPTS = 6;

async function main() {
  const [listPathArg, linkSelector, scrollYArg = '2500', username = 'carol'] = process.argv.slice(2);
  // Git Bash rewrites a leading-slash argument into a Windows path, so the path is passed without it.
  const listPath = listPathArg?.startsWith('/') ? listPathArg : `/${listPathArg ?? ''}`;
  if (!listPathArg || !linkSelector) {
    console.error('usage: scroll-entry-trace.cjs <listPath> <linkSelector> [scrollY] [username]');
    process.exit(2);
  }
  const targetY = Number(scrollYArg);
  const browser = await launch();
  try {
    const { page } = await openAs(browser, username, listPath, { hydrate: linkSelector });
    for (let i = 0; i < LIST_GROW_ATTEMPTS; i++) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      if (height >= targetY + 1200) break;
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(1500);
    }
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), targetY);
    await page.waitForTimeout(800);

    const index = await page.evaluate(
      (selector) =>
        [...document.querySelectorAll(selector)].findIndex((a) => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.top > 150 && r.bottom < window.innerHeight - 50;
        }),
      linkSelector,
    );
    if (index < 0) {
      console.log('FAIL no link matching the selector is visible after scrolling');
      process.exitCode = 1;
      return;
    }
    const link = page.locator(linkSelector).nth(index);
    const href = await link.getAttribute('href');
    const listY = await page.evaluate(() => Math.round(window.scrollY));
    const listPathname = await page.evaluate(() => window.location.pathname);

    await page.evaluate((traceMs) => {
      window.__scrollTrace = [];
      const t0 = performance.now();
      const tick = () => {
        window.__scrollTrace.push({
          t: Math.round(performance.now() - t0),
          y: Math.round(window.scrollY),
          path: window.location.pathname,
          // Visible nodes only: Next 16 keeps the previous route in the DOM (hidden) for Back.
          skeleton: [...document.querySelectorAll('.animate-pulse, [aria-busy="true"]')].some((el) => el.checkVisibility()),
          h1: [...document.querySelectorAll('h1')].find((el) => el.checkVisibility())?.textContent?.trim().slice(0, 24) ?? '',
        });
        if (performance.now() - t0 < traceMs) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, TRACE_MS);
    await link.click();
    await page.waitForTimeout(TRACE_MS + 200);
    const frames = await page.evaluate(() => window.__scrollTrace);

    console.log(`== ${listPathname} (y=${listY}) → ${href}`);
    let previous = '';
    for (const f of frames) {
      const key = `${f.y}|${f.path}|${f.skeleton}|${f.h1}`;
      if (key !== previous) console.log(`  ${f.t}ms y=${f.y} ${f.path} skeleton=${f.skeleton} h1="${f.h1}"`);
      previous = key;
    }
    const pageFrames = frames.filter((f) => f.path !== listPathname);
    const offTop = pageFrames.filter((f) => (f.skeleton || f.h1) && f.y !== 0);
    console.log(`${offTop.length === 0 ? 'PASS' : 'FAIL'} new page never painted off the top`);

    await page.goBack();
    await page.waitForTimeout(2500);
    const backY = await page.evaluate(() => Math.round(window.scrollY));
    const restored = Math.abs(backY - listY) < 5;
    console.log(`${restored ? 'PASS' : 'FAIL'} Back restores the list offset (y=${backY}, expected ${listY})`);
    if (offTop.length > 0 || !restored) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('SCRIPT ERROR', error);
  process.exit(1);
});
