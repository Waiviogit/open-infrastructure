import type { CatalogMessages, LocaleId } from '../types';

const cache = new Map<LocaleId, CatalogMessages>();

export async function getOrLoadMessages(
  locale: LocaleId,
  loader: () => Promise<CatalogMessages>,
): Promise<CatalogMessages> {
  const hit = cache.get(locale);
  if (hit) {
    return hit;
  }
  const messages = await loader();
  cache.set(locale, messages);
  return messages;
}
