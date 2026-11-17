/** @jest-environment node */

jest.mock('server-only', () => ({}));

import { NextRequest } from 'next/server';

import { GET } from './route';

const URN = 'urn:li:share:7528142279761571840';
const EMBED_HTML =
  '<article><div data-test-id="main-feed-activity-embed-card__entity-lockup"></div>' +
  '<p data-test-id="main-feed-activity-embed-card__commentary">Hello</p></article>';

function request(urn: string): NextRequest {
  return new NextRequest(`http://localhost/api/social-embed/linkedin?urn=${encodeURIComponent(urn)}`);
}

describe('GET /api/social-embed/linkedin', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns 400 for a value that is not a post URN', async () => {
    global.fetch = jest.fn() as typeof fetch;
    const response = await GET(request('https://evil.example'));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the parsed card layout from the embed page', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => EMBED_HTML,
    }) as typeof fetch;

    const response = await GET(request(URN));
    const body = (await response.json()) as { layout: unknown };

    expect(response.status).toBe(200);
    expect(body.layout).toEqual({ commentary: 'Hello', hasActivityHeader: false, media: 'none' });
    expect(response.headers.get('Cache-Control')).toContain('max-age=3600');
    const upstreamUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(upstreamUrl).toBe(`https://www.linkedin.com/embed/feed/update/${URN}`);
  });

  it('returns 422 when the card has a block it cannot size', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `${EMBED_HTML}<div data-test-id="feed-video-content"></div>`,
    }) as typeof fetch;
    const response = await GET(request(URN));
    expect(response.status).toBe(422);
  });

  it('passes a missing post through as 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;
    const response = await GET(request(URN));
    expect(response.status).toBe(404);
  });

  it('returns 502 when LinkedIn is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch;
    const response = await GET(request(URN));
    expect(response.status).toBe(502);
  });
});
