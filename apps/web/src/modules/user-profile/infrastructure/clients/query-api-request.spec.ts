import {
  executeQueryApiRequest,
  isCacheableBody,
  normalizeQueryApiHeaders,
  resolveQueryApiUrl,
} from './query-api-request';

describe('resolveQueryApiUrl', () => {
  it('joins the base and a relative path with exactly one slash', () => {
    expect(resolveQueryApiUrl('http://api/', '/query/v1/x')).toBe('http://api/query/v1/x');
    expect(resolveQueryApiUrl('http://api', 'query/v1/x')).toBe('http://api/query/v1/x');
  });

  it('keeps absolute URLs', () => {
    expect(resolveQueryApiUrl('http://api', 'https://other/x')).toBe('https://other/x');
  });
});

describe('normalizeQueryApiHeaders', () => {
  it('lower-cases and sorts names so equivalent requests share a cache key', () => {
    const a = normalizeQueryApiHeaders({ 'X-Viewer': 'carol', 'Content-Type': 'application/json' });
    const b = normalizeQueryApiHeaders([
      ['content-type', 'application/json'],
      ['x-viewer', 'carol'],
    ]);
    expect(a).toEqual(b);
    expect(Object.keys(a)).toEqual(['content-type', 'x-viewer']);
  });

  it('applies extra headers over the caller headers', () => {
    expect(
      normalizeQueryApiHeaders({ 'X-Forwarded-For': 'old' }, { 'X-Forwarded-For': '1.2.3.4' }),
    ).toEqual({ 'x-forwarded-for': '1.2.3.4' });
  });
});

describe('isCacheableBody', () => {
  it('accepts no body and string bodies only', () => {
    expect(isCacheableBody(undefined)).toBe(true);
    expect(isCacheableBody(null)).toBe(true);
    expect(isCacheableBody('{"a":1}')).toBe(true);
    expect(isCacheableBody(new URLSearchParams('a=1'))).toBe(false);
  });
});

describe('executeQueryApiRequest', () => {
  const request = { url: 'http://api/x', method: 'GET', headers: {} };
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns parsed JSON for an OK response and never uses the fetch Data Cache', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ a: 1 }), { status: 200 }));

    await expect(executeQueryApiRequest(request, '/x')).resolves.toEqual({ ok: true, data: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledWith('http://api/x', expect.objectContaining({ cache: 'no-store' }));
  });

  it('maps non-OK, network and invalid JSON to failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(executeQueryApiRequest(request, '/x')).resolves.toEqual({ ok: false, status: 404 });

    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(executeQueryApiRequest(request, '/x')).resolves.toEqual({ ok: false, status: 'network' });

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(executeQueryApiRequest(request, '/x')).resolves.toEqual({ ok: false, status: 200 });
  });
});
