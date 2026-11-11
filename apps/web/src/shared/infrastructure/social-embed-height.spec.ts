/**
 * @jest-environment jsdom
 */
import {
  applySocialEmbedFrameHeight,
  isSocialEmbedResizeOrigin,
  parseSocialEmbedHeight,
} from './social-embed-height';

describe('parseSocialEmbedHeight', () => {
  it('reads Instagram MEASURE details.height', () => {
    expect(
      parseSocialEmbedHeight(
        JSON.stringify({ type: 'MEASURE', details: { height: 812 } }),
      ),
    ).toBe(812);
  });

  it('reads Facebook xfbml resize height', () => {
    expect(parseSocialEmbedHeight({ type: 'xfbml:resize', height: 640 })).toBe(
      640,
    );
  });

  it('reads nested Twitter widget params', () => {
    expect(
      parseSocialEmbedHeight({
        method: 'twttr.private.resize',
        params: [{ height: 520, width: 540 }],
      }),
    ).toBe(520);
  });

  it('rejects implausible values', () => {
    expect(parseSocialEmbedHeight({ height: 12 })).toBeNull();
    expect(parseSocialEmbedHeight({ height: 9000 })).toBeNull();
    expect(parseSocialEmbedHeight('nope')).toBeNull();
  });
});

describe('applySocialEmbedFrameHeight', () => {
  it('shows the whole Instagram embed — wrapper is as tall as the iframe', () => {
    const wrap = document.createElement('div');
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.instagram.com/p/DcncWF8DaIb/embed';
    wrap.appendChild(iframe);

    applySocialEmbedFrameHeight(iframe, 883);

    expect(iframe.style.height).toBe('883px');
    expect(wrap.style.height).toBe('883px');
    expect(wrap.style.minHeight).toBe('883px');
  });
});

describe('isSocialEmbedResizeOrigin', () => {
  it('allows Instagram, Facebook, X, and LinkedIn', () => {
    expect(isSocialEmbedResizeOrigin('https://www.instagram.com')).toBe(true);
    expect(isSocialEmbedResizeOrigin('https://www.facebook.com')).toBe(true);
    expect(isSocialEmbedResizeOrigin('https://platform.twitter.com')).toBe(true);
    expect(isSocialEmbedResizeOrigin('https://www.linkedin.com')).toBe(true);
    expect(isSocialEmbedResizeOrigin('https://www.youtube.com')).toBe(false);
  });
});
