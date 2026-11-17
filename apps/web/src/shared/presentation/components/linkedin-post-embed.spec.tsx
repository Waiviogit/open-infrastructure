/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';
import type { LinkedInPostCard } from '@/shared/infrastructure/linkedin-post-card';

import { SocialEmbedHtml } from './social-embed-html';

const messages = {
  linkedin_post_open: 'Open on LinkedIn',
} as unknown as Messages;

function card(
  urn: string,
  overrides: Partial<LinkedInPostCard> = {},
): LinkedInPostCard {
  return {
    permalink: `https://www.linkedin.com/feed/update/${urn}`,
    activityHeader: null,
    author: {
      name: 'Matteo Collina',
      headline: 'Platformatic Co-Founder & CTO',
      profileUrl: 'https://www.linkedin.com/in/matteocollina',
      avatarUrl: null,
    },
    commentary: 'Are you ready for NodeConfEU 2027?',
    media: {
      kind: 'images',
      images: [
        {
          url: 'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/1',
          alt: 'Stage',
        },
      ],
    },
    reactionCount: 154,
    commentCount: 4,
    ...overrides,
  };
}

function postHtml(urn: string): string {
  return (
    '<p>Intro</p><div class="blog-post-linkedin-embed">' +
    `<iframe src="https://www.linkedin.com/embed/feed/update/${urn}" title="LinkedIn post" scrolling="no" loading="lazy"></iframe>` +
    '</div>'
  );
}

function renderHtml(html: string) {
  return render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <SocialEmbedHtml html={html} />
    </I18nProvider>,
  );
}

describe('SocialEmbedHtml LinkedIn cards', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders a native card in place of the LinkedIn iframe', async () => {
    const urn = 'urn:li:share:7523793420038053888';
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ card: card(urn) }),
      }) as typeof fetch;

    const { container } = renderHtml(postHtml(urn));

    expect(container.querySelector('iframe')).toBeNull();
    expect(await screen.findByText('Matteo Collina')).toBeTruthy();
    const slot = container.querySelector(
      `[data-linkedin-urn="${urn}"]`,
    ) as HTMLElement;
    expect(slot.textContent).toContain('Are you ready for NodeConfEU 2027?');
    expect(screen.getByRole('img', { name: 'Stage' }).getAttribute('src')).toBe(
      'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/1',
    );
    expect(
      screen
        .getByRole('link', { name: 'Open on LinkedIn' })
        .getAttribute('href'),
    ).toBe(`https://www.linkedin.com/feed/update/${urn}`);
  });

  it('falls back to the official iframe when the card is unavailable', async () => {
    const urn = 'urn:li:share:7519434746624401408';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 422 }) as typeof fetch;

    const { container } = renderHtml(postHtml(urn));

    await waitFor(() =>
      expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
        `https://www.linkedin.com/embed/feed/update/${urn}`,
      ),
    );
  });
});
