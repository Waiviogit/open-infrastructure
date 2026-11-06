import '@testing-library/jest-dom';

// `cacheLife` / `cacheTag` throw outside a Next.js runtime with `cacheComponents`. Unit tests run
// `'use cache'` functions as plain async functions, so these become no-ops; specs that assert on
// them mock `next/cache` themselves.
jest.mock('next/cache', () => ({
  ...jest.requireActual('next/cache'),
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
}));
