import { safeHttpUrl } from '@/shared/domain';

const HAS_URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE_PREFIX = '//';
const MAILTO_PREFIX = /^mailto:/i;

/**
 * Web link target typed by the author: `waivio.com` → `https://waivio.com/`,
 * `//cdn.example.com/a` → `https://cdn.example.com/a`. Only http(s) is accepted (no `javascript:` /
 * `data:`); a site-relative path (`/foo`) is rejected because the post body is rendered on other hosts.
 */
export function normalizeWebLinkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith(PROTOCOL_RELATIVE_PREFIX)) {
    return safeHttpUrl(`https:${trimmed}`);
  }
  if (trimmed.startsWith('/')) {
    return null;
  }
  const withScheme = HAS_URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  return safeHttpUrl(withScheme);
}

/** Text link target: a `mailto:` address is kept as is, anything else follows {@link normalizeWebLinkUrl}. */
export function normalizeTextLinkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!MAILTO_PREFIX.test(trimmed)) {
    return normalizeWebLinkUrl(trimmed);
  }
  try {
    const url = new URL(trimmed);
    return url.pathname ? url.toString() : null;
  } catch {
    return null;
  }
}
