'use strict';

/**
 * Recipe Details featured post (seeded by object-post-pin-remove.scenario.ts `featured` step):
 * `pinv-recipe` shows its top pinned post in the middle column, `pinv-recipe-plain` keeps the description.
 * Usage: node object-featured-post.web.cjs <screenshotDir>
 */
const path = require('path');
const { launch, openAs } = require('../web-session.cjs');

const OUT = process.argv[2] ?? '.';

async function middleColumn(page) {
  return page.evaluate(() => {
    const article = [...document.querySelectorAll('main article')].find((a) => a.offsetParent !== null);
    const column = document.querySelector('main .overflow-x-clip');
    return {
      articleTitle: article?.querySelector('h1, h2')?.textContent?.trim() ?? null,
      columnText: column?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
    };
  });
}

(async () => {
  const browser = await launch();
  try {
    for (const [objectId, shot] of [
      ['pinv-recipe', 'featured-details.png'],
      ['pinv-recipe-plain', 'featured-plain.png'],
    ]) {
      const { page, status } = await openAs(browser, 'vic', `/object/${objectId}`, { hydrate: 'button' });
      console.log(objectId, 'status', status, JSON.stringify(await middleColumn(page)));
      await page.screenshot({ path: path.join(OUT, shot), fullPage: false });
      await page.context().close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
