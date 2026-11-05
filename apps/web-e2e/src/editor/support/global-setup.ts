import { accessToken, EDITOR_E2E_BASE_URL } from './session';

const WARM_UP_TIMEOUT_MS = 300_000;

/**
 * `next dev` compiles `/editor` on first request; a browser landing mid-compile gets
 * a reload during hydration ("expected layout router to be mounted"). Compile it once
 * up front with a signed-in request.
 */
export default async function globalSetup(): Promise<void> {
  const response = await fetch(`${EDITOR_E2E_BASE_URL}/editor`, {
    headers: { Cookie: `odl_access=${accessToken('e2e-warm-up')}` },
    signal: AbortSignal.timeout(WARM_UP_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Editor warm-up failed: HTTP ${response.status}`);
  }
}
