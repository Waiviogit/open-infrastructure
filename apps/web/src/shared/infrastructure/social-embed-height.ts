const HEIGHT_KEYS = ['height', 'clientHeight', 'scrollHeight', 'iframeHeight'] as const;

const NESTED_KEYS = ['details', 'payload', 'params', 'data', 'value'] as const;

const SOCIAL_EMBED_HOSTS = new Set([
  'instagram.com',
  'facebook.com',
  'platform.twitter.com',
  'twitter.com',
  'linkedin.com',
]);

export function isSocialEmbedResizeOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase();
    return SOCIAL_EMBED_HOSTS.has(host);
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toEmbedHeight(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? clampEmbedHeight(raw) : null;
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clampEmbedHeight(parsed) : null;
  }
  return null;
}

function clampEmbedHeight(value: number): number | null {
  const rounded = Math.round(value);
  if (rounded < 80 || rounded > 4000) {
    return null;
  }
  return rounded;
}

function findHeight(value: unknown, depth: number): number | null {
  if (depth > 4) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHeight(item, depth + 1);
      if (found != null) {
        return found;
      }
    }
    return null;
  }
  const rec = asRecord(value);
  if (!rec) {
    return null;
  }
  for (const key of HEIGHT_KEYS) {
    const height = toEmbedHeight(rec[key]);
    if (height != null) {
      return height;
    }
  }
  for (const nested of NESTED_KEYS) {
    if (nested in rec) {
      const found = findHeight(rec[nested], depth + 1);
      if (found != null) {
        return found;
      }
    }
  }
  return null;
}

/** Height in px from Instagram / Facebook / X / LinkedIn iframe `postMessage` payloads. */
export function parseSocialEmbedHeight(data: unknown): number | null {
  if (typeof data === 'number') {
    return toEmbedHeight(data);
  }
  let payload: unknown = data;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed === '') {
      return null;
    }
    try {
      payload = JSON.parse(trimmed) as unknown;
    } catch {
      const m = trimmed.match(/height["'\s:=]+(\d{2,5})/i);
      return toEmbedHeight(m?.[1]);
    }
  }
  return findHeight(payload, 0);
}

/** Grows the iframe and its wrapper to the full posted height — embeds are never clipped. */
export function applySocialEmbedFrameHeight(
  iframe: HTMLIFrameElement,
  height: number,
): void {
  iframe.style.height = `${height}px`;
  iframe.style.minHeight = `${height}px`;
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('scrolling', 'no');
  const wrap = iframe.parentElement;
  if (!wrap) {
    return;
  }
  wrap.style.height = `${height}px`;
  wrap.style.minHeight = `${height}px`;
  wrap.style.aspectRatio = 'auto';
  wrap.style.overflow = 'hidden';
}
