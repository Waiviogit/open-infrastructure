import {
  postBodyLooksLikeHtml,
  postBodyToIntermediateHtml,
  sanitizePostBodyHtml,
} from './post-body-html-pipeline';

describe('image alt captions (integration, real marked)', () => {
  const src = 'https://images.hive.blog/p/photo.jpg';

  it('shows a meaningful alt under a linked image and keeps the image a link', () => {
    const html = sanitizePostBodyHtml(
      `Intro\n\n[![Cheam Sushi tray](${src})](https://waivio.com/object/cheam)\n\nOutro`,
    );

    expect(html).toMatch(
      /<a href="https:\/\/waivio\.com\/object\/cheam"><img [^>]*alt="Cheam Sushi tray"[^>]*\/?><\/a><span class="post-image-caption">Cheam Sushi tray<\/span>/,
    );
  });

  it('does not show a file name alt', () => {
    expect(sanitizePostBodyHtml(`![IMG_20240501.jpg](${src})`)).not.toContain('post-image-caption');
  });

  it('does not caption an image inside a paragraph of text', () => {
    expect(sanitizePostBodyHtml(`Look ![tiny icon](${src}) here`)).not.toContain(
      'post-image-caption',
    );
  });

  it('keeps the caption escaped', () => {
    const html = sanitizePostBodyHtml(
      `<p><img src="${src}" alt="&lt;script&gt;x&lt;/script&gt; &amp; co"></p>`,
    );

    expect(html).toContain(
      '<span class="post-image-caption">&lt;script&gt;x&lt;/script&gt; &amp; co</span>',
    );
    expect(html).not.toContain('<script>');
  });
});

describe('sanitizePostBodyHtml (integration, real marked)', () => {
  it('renders Peakd 3Speak markdown body with headings, links, and iframe', () => {
    const poster =
      'https://i.ecency.com/DQmNSDpbjTxvzFpyQDwpNpX2gssGkdTXRFa2rfCwiSS4Eyp/thumb_1783842295927.jpg';
    const watchUrl =
      'https://3speak.tv/watch?v=sagarkothari88/8563feac';
    const body =
      `[![](${poster})](${watchUrl}) ▶️ [Watch on 3Speak](${watchUrl})\n\n---\n\n# HiveReactKit\n\nSee [Support via Discord](https://discord.gg/WEKa8JKg7W).`;

    expect(postBodyLooksLikeHtml(body)).toBe(false);

    const intermediate = postBodyToIntermediateHtml(body);
    expect(intermediate).toContain('<h1');
    expect(intermediate).toContain('href="https://discord.gg/WEKa8JKg7W"');

    const html = sanitizePostBodyHtml(body);

    expect(html).toContain('blog-post-3speak-embed');
    expect(html).toContain('sagarkothari88%2F8563feac');
    expect(html).toContain('mode=iframe');
    expect(html).not.toContain('8563feac)');

    expect(html).toMatch(/<h1[^>]*>\s*HiveReactKit\s*<\/h1>/i);
    expect(html).toContain('href="https://discord.gg/WEKa8JKg7W"');
    expect(html).not.toContain('[Support via Discord]');
    expect(html).not.toContain('[Watch on 3Speak]');
  });

  it('embeds Instagram post URL from markdown into a sanitized iframe', () => {
    const body =
      'WHITE GARDEN invites guests to enjoy sunny summer days with delicious dishes, refreshing drinks, and a relaxed outdoor atmosphere.\n\nhttps://www.instagram.com/p/DcncWF8DaIb/';

    expect(postBodyLooksLikeHtml(body)).toBe(false);

    const html = sanitizePostBodyHtml(body);
    expect(html).toContain('WHITE GARDEN');
    expect(html).toContain('blog-post-instagram-embed');
    expect(html).toContain(
      'src="https://www.instagram.com/p/DcncWF8DaIb/embed"',
    );
    expect(html).not.toContain(
      'href="https://www.instagram.com/p/DcncWF8DaIb/"',
    );
  });
});
