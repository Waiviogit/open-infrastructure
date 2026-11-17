/**
 * @jest-environment jsdom
 */
import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';

import { useFitLinkedInEmbeds } from './use-fit-linkedin-embeds';

const EMBED_SRC = 'https://www.linkedin.com/embed/feed/update/urn:li:share:7528142279761571840';

function Harness({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitLinkedInEmbeds(ref);
  return (
    <div ref={ref}>
      <div className="blog-post-linkedin-embed">
        <iframe title="LinkedIn post" src={src} />
      </div>
    </div>
  );
}

describe('useFitLinkedInEmbeds', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(340);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sizes the iframe and its wrapper from the card layout', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ layout: { commentary: '', hasActivityHeader: false, media: 'none' } }),
    }) as typeof fetch;

    const { container } = render(<Harness src={EMBED_SRC} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;

    // Empty commentary: card chrome (181) + safety (8).
    await waitFor(() => expect(iframe.style.height).toBe('189px'));
    expect((iframe.parentElement as HTMLElement).style.height).toBe('189px');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      '/api/social-embed/linkedin?urn=urn%3Ali%3Ashare%3A7528142279761571840',
    );
  });

  it('ignores iframes from other hosts', async () => {
    global.fetch = jest.fn() as typeof fetch;
    const { container } = render(<Harness src="https://www.youtube.com/embed/abcdefghijk" />);
    await Promise.resolve();
    expect(global.fetch).not.toHaveBeenCalled();
    expect((container.querySelector('iframe') as HTMLIFrameElement).style.height).toBe('');
  });
});
