/** Upper bound of remembered URLs; the oldest entry is dropped first. */
const IMAGE_FALLBACK_MEMORY_MAX_ENTRIES = 200;

export type ImageFallbackMemory<Phase extends string> = {
  get: (url: string) => Phase | undefined;
  remember: (url: string, phase: Phase) => void;
};

/**
 * Remembers how far an image URL went down its fallback chain (raw → proxy → …) in this tab.
 * A component that remounts with the same URL — the object hero painted from the head, then from the
 * full model — starts at the phase that worked instead of retrying a broken source and flickering.
 */
export function createImageFallbackMemory<Phase extends string>(): ImageFallbackMemory<Phase> {
  const phases = new Map<string, Phase>();
  return {
    get: (url) => phases.get(url),
    remember: (url, phase) => {
      phases.delete(url);
      phases.set(url, phase);
      if (phases.size > IMAGE_FALLBACK_MEMORY_MAX_ENTRIES) {
        const oldest = phases.keys().next().value;
        if (oldest !== undefined) {
          phases.delete(oldest);
        }
      }
    },
  };
}
