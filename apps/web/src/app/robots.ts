import type { MetadataRoute } from 'next';
import { connection } from 'next/server';

import { seoPublicOrigin } from '@/seo';

export default async function robots(): Promise<MetadataRoute.Robots> {
  // The public origin is deploy-time env, not build-time: a prerendered robots.txt would have no
  // Sitemap/Host lines. Render per request (it is tiny and reads no data).
  await connection();
  const origin = seoPublicOrigin();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/sign-in',
          '/api/',
          '/editor',
          '/drafts',
          '/settings',
          '/notifications',
        ],
      },
    ],
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
    host: origin ?? undefined,
  };
}
