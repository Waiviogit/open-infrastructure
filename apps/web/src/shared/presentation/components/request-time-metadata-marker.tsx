import { connection } from 'next/server';
import { Suspense } from 'react';

async function RequestTimeConnection() {
  await connection();
  return null;
}

/**
 * Renders nothing. A page whose body is fully static but whose `generateMetadata` reads request
 * data (locale cookie) must say that request-time rendering is intended, or Cache Components
 * reports "runtime data in generateMetadata()". The empty `<Suspense>` keeps the body in the static
 * shell. See `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
 * ("With Cache Components").
 */
export function RequestTimeMetadataMarker() {
  return (
    <Suspense>
      <RequestTimeConnection />
    </Suspense>
  );
}
