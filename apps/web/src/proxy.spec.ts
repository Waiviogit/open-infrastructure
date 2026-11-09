/** @jest-environment node */

jest.mock('server-only', () => ({}));

const mockEnv = {
  requireAuth: true,
  publicOrigin: 'https://waiviodev.com',
};

jest.mock('@/config/env', () => ({
  env: mockEnv,
}));

jest.mock('@/shared/infrastructure/auth/refresh-session', () => ({
  refreshSessionCookiesIfNeeded: jest.fn().mockResolvedValue({ kind: 'unchanged' }),
  applyProxySessionRefreshToResponse: jest.fn(
    (response: unknown) => response,
  ),
}));

import { NextRequest } from 'next/server';

import { proxy } from './proxy';

describe('proxy requireAuth gate', () => {
  beforeEach(() => {
    mockEnv.requireAuth = true;
  });

  it('allows anonymous GET /has without redirect to sign-in', async () => {
    const request = new NextRequest('https://waiviodev.com/has');
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects anonymous GET /discover to sign-in', async () => {
    const request = new NextRequest('https://waiviodev.com/discover');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://waiviodev.com/sign-in');
  });
});

describe('proxy profile account segment', () => {
  beforeEach(() => {
    mockEnv.requireAuth = false;
  });

  it('answers 404 for a malformed account before the profile route renders', async () => {
    const response = await proxy(new NextRequest('https://waiviodev.com/@bad!name'));

    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://waiviodev.com/_not-found');
  });

  it('rewrites a well-formed account to the profile route', async () => {
    const response = await proxy(new NextRequest('https://waiviodev.com/@alice/threads'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://waiviodev.com/user-profile/alice/threads',
    );
  });
});

describe('proxy bare /discover', () => {
  beforeEach(() => {
    mockEnv.requireAuth = false;
  });

  it('redirects to the remembered type before rendering, keeping filters', async () => {
    const request = new NextRequest('https://waiviodev.com/discover?q=pizza', {
      headers: { cookie: 'discover_object_type=restaurant' },
    });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://waiviodev.com/discover?type=restaurant&q=pizza',
    );
  });

  it('passes through when the URL already selects a type', async () => {
    const response = await proxy(new NextRequest('https://waiviodev.com/discover?type=book'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
