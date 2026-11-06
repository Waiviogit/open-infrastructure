'use strict';

/**
 * Click-to-paint timing for one client navigation, under an emulated network round trip.
 * Answers "what does Next wait for after the click": when the URL changes, when the
 * destination skeleton paints, when its content paints, and which requests ran.
 *
 * Usage (prod server on VERIFY_WEB_URL, default http://localhost:3991 — prefetch only runs in prod):
 *   node .claude/skills/verify/scripts/nav-instant-trace.cjs <listPath without leading slash> <linkSelector> [options]
 *   node .claude/skills/verify/scripts/nav-instant-trace.cjs feed/updates 'main li > a[href^="/object/"]' --rtt 150 --hover 200
 *
 * Options:
 *   --rtt <ms>       emulated latency per request via CDP (default 150; 0 = none)
 *   --hover <ms>     hover the link this long before clicking (default 0 = plain click)
 *   --dest <prefix>  destination pathname prefix without leading slash (default: the link href)
 *   --user <name>    signed-in user (default carol)
 *   --skeleton <css> destination skeleton root (default [aria-busy="true"]), e.g. [aria-label="Loading object"]
 *   --content <css>  destination content marker (default h1)
 *
 * "skeleton" = the --skeleton element on the destination path before the --content element appears.
 * Pass a destination-specific skeleton: links that update the URL instantly (OptimisticNavLink)
 * still show the list, and a generic selector would match list placeholders. Target after the Cache Components /
 * Partial Prefetching migration: skeleton in the first frames after the click, not after
 * a full round trip.
 */

const { launch, openAs } = require('./web-session.cjs');

const TRACE_MS = 5000;

function parseArgs(argv) {
  const [listArg, linkSelector, ...rest] = argv;
  const options = { rtt: 150, hover: 0, dest: null, user: 'carol', skeleton: '[aria-busy="true"]', content: 'h1' };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    const value = rest[i + 1];
    if (key === 'rtt' || key === 'hover') options[key] = Number(value);
    else if (['dest', 'user', 'skeleton', 'content'].includes(key)) options[key] = value;
  }
  // Git Bash rewrites a leading-slash argument into a Windows path, so the path is passed without it.
  const listPath = listArg?.startsWith('/') ? listArg : `/${listArg ?? ''}`;
  return { listArg, listPath, linkSelector, options };
}

async function main() {
  const { listArg, listPath, linkSelector, options } = parseArgs(process.argv.slice(2));
  if (!listArg || !linkSelector) {
    console.error('usage: nav-instant-trace.cjs <listPath> <linkSelector> [--rtt ms] [--hover ms] [--dest prefix] [--user name]');
    process.exit(2);
  }
  const browser = await launch();
  try {
    const { page } = await openAs(browser, options.user, listPath, { hydrate: linkSelector });
    const requests = [];
    page.on('request', (r) => {
      if (r.url().includes('_rsc=') || r.url().includes('/_next/static/chunks/app/')) {
        requests.push({ url: r.url(), t: Date.now(), prefetch: Boolean(r.headers()['next-router-prefetch']) });
      }
    });
    if (options.rtt > 0) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: options.rtt,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    }

    const index = await page.evaluate(
      (selector) =>
        [...document.querySelectorAll(selector)].findIndex((a) => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.top > 120 && r.bottom < window.innerHeight - 40;
        }),
      linkSelector,
    );
    if (index < 0) {
      console.log('FAIL no link matching the selector is visible');
      process.exitCode = 1;
      return;
    }
    const link = page.locator(linkSelector).nth(index);
    const href = (await link.getAttribute('href')) ?? '';
    const destArg = options.dest ?? href.split('?')[0];
    const destPrefix = destArg.startsWith('/') ? destArg : `/${destArg}`;
    await page.waitForTimeout(1500);
    const requestsBeforeHover = requests.length;
    if (options.hover > 0) {
      await link.hover();
      await page.waitForTimeout(options.hover);
    }

    await page.evaluate(({ traceMs, skeletonSelector, contentSelector }) => {
      window.__navTrace = [];
      const t0 = performance.now();
      const tick = () => {
        window.__navTrace.push({
          t: Math.round(performance.now() - t0),
          path: window.location.pathname,
          skeleton: Boolean(document.querySelector(skeletonSelector)),
          h1: document.querySelector(contentSelector)?.textContent?.trim().slice(0, 24) ?? '',
        });
        if (performance.now() - t0 < traceMs) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { traceMs: TRACE_MS, skeletonSelector: options.skeleton, contentSelector: options.content });
    const clickAt = Date.now();
    await link.click();
    await page.waitForTimeout(TRACE_MS + 200);
    const frames = await page.evaluate(() => window.__navTrace);

    const onDest = (f) => f.path.startsWith(destPrefix);
    const urlFrame = frames.find(onDest);
    const skeletonFrame = frames.find((f) => onDest(f) && f.skeleton && !f.h1);
    const contentFrame = frames.find((f) => onDest(f) && f.h1);
    console.log(`== ${listPath} → ${href} | rtt ${options.rtt}ms | hover ${options.hover}ms`);
    console.log(
      `  click→URL ${urlFrame?.t ?? '-'}ms | click→skeleton ${skeletonFrame ? `${skeletonFrame.t}ms` : 'never'} | click→content ${contentFrame?.t ?? '-'}ms`,
    );
    console.log(`  RSC/chunk requests while idle on the list (before hover/click): ${requestsBeforeHover}`);
    for (const r of requests.slice(requestsBeforeHover)) {
      const u = new URL(r.url);
      const label = u.pathname.startsWith('/_next/') ? 'chunk' : r.prefetch ? 'prefetch' : 'navigation';
      console.log(`  ${label.padEnd(10)} ${r.t - clickAt >= 0 ? '+' : ''}${r.t - clickAt}ms ${u.pathname.slice(0, 80)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('SCRIPT ERROR', error);
  process.exit(1);
});
