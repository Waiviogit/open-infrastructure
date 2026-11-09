//@ts-check

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Agent rules live in apps/web/AGENTS.md (repo-managed); stop `next dev` from appending its own block.
  agentRules: false,
  // Dev-only: allow /_next dev resources (HMR, chunks) when the app is opened via 127.0.0.1 (local verification).
  allowedDevOrigins: ['127.0.0.1'],
  // Cache Components: request-time data streams behind <Suspense>; caching is explicit via
  // 'use cache' (query-api reads: modules/user-profile/infrastructure/clients/query-api.client.ts).
  // Routes not adopted yet keep `export const instant = false` (see docs/apps/web/spec/caching.md).
  cacheComponents: true,
  // Explicit until the Partial Prefetching step of the migration (Next warns when unset).
  partialPrefetching: false,
  // Image paste/upload Server Actions (FormData); default Next limit is 1mb.
  experimental: {
    // Instant Navigation testing API for the `instant()` e2e suite (apps/web-e2e/instant-nav.rig.md).
    // Only a dedicated test build sets EXPOSE_TESTING_API=1; real builds never expose it.
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === '1',
    serverActions: {
      bodySizeLimit: '50mb',
    },
    optimizePackageImports: ['lucide-react'],
  },
  /**
   * `/@account/…` → `/user-profile/account/…` is handled in `src/proxy.ts` (Next.js 16 proxy).
   */
  // Static route aliases: a 307 before rendering, so no page segment has to block on `redirect()`.
  async redirects() {
    return [
      { source: '/business', destination: '/business/offers', permanent: false },
      { source: '/offers', destination: '/business/offers', permanent: false },
      { source: '/requests', destination: '/business/requests', permanent: false },
      { source: '/tools', destination: '/notifications/settings', permanent: false },
      // Legacy manage paths: `/business/{offers,requests}/<rest>` → `/business/manage/…/<rest>`.
      {
        source: '/business/offers/:rest+',
        destination: '/business/manage/offers/:rest+',
        permanent: false,
      },
      {
        source: '/business/requests/:rest+',
        destination: '/business/manage/requests/:rest+',
        permanent: false,
      },
    ];
  },
  // Request Client Hints so SSR can resolve `system` theme via `Sec-CH-Prefers-Color-Scheme`
  // (see get-server-theme-resolution.ts). Without this, the server often defaults to light.
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      {
        key: 'Content-Security-Policy',
        value:
          "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
      },
    ];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Accept-CH', value: 'Sec-CH-Prefers-Color-Scheme' },
          { key: 'Vary', value: 'Sec-CH-Prefers-Color-Scheme' },
          ...securityHeaders,
        ],
      },
    ];
  },
  // Minimal self-contained output for Docker (see apps/web/Dockerfile).
  // On Windows, local `next build` may fail copying standalone symlinks (EPERM); use Docker/WSL or Developer Mode.
  output: 'standalone',
  images: {
    // Known CDNs + broad HTTPS pattern for UGC (thumbnails, covers, custom avatars).
    // Long-term: consider an image proxy and tighten patterns. See docs/apps/web/spec/images.md.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.hive.blog' },
      { protocol: 'https', hostname: 'cdn.steemitimages.com' },
      { protocol: 'https', hostname: '**' },
      // UGC may use legacy http:// URLs (e.g. imgur); https-only patterns reject those.
      { protocol: 'http', hostname: '**' },
    ],
    minimumCacheTTL: 86400,
  },
  // Trace from monorepo root so file tracing includes shared workspace paths correctly.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Dynamic locale JSON imports are not always captured in server traces; include explicitly.
  outputFileTracingIncludes: {
    '/*': ['src/i18n/locales/**/*.json'],
  },
};

module.exports = nextConfig;
