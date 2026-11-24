import type { LocaleId, Messages, MessageValues, Translate } from '../types';
import { formatMessage } from './format-message';
import { pluralKeyCandidates } from './plural';

function resolveTemplate(
  messages: Messages,
  key: string,
  count: string | number | undefined,
  locale: LocaleId,
): string {
  if (typeof count === 'number') {
    for (const candidate of pluralKeyCandidates(key, count, locale)) {
      const template = messages[candidate];
      if (template !== undefined) {
        return template;
      }
    }
  }
  return messages[key] ?? key;
}

/**
 * The one translator implementation, shared by the client `I18nProvider` and server code
 * (metadata builders, not-found pages):
 *   - `t(key)` returns the catalog text, or the key itself when the catalog lacks it;
 *   - `t(key, values)` also fills `{name}` placeholders;
 *   - a numeric `values.count` first tries the plural forms `key_<category>` of `locale`.
 */
export function createTranslator(messages: Messages, locale: LocaleId): Translate {
  return (key: string, values?: MessageValues) =>
    formatMessage(resolveTemplate(messages, key, values?.count, locale), values);
}
