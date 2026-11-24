import type { MessageValues } from '../types';

const PLACEHOLDER_SOURCE = '\\{([A-Za-z0-9_]+)\\}';

/** A fresh global matcher for `{name}` placeholders (callers may iterate it with `exec`). */
export function messagePlaceholderPattern(): RegExp {
  return new RegExp(PLACEHOLDER_SOURCE, 'g');
}

/**
 * Splits a translated text around its first `{name}` placeholder, for UI that renders an element
 * (a link, an input) in its place. Returns null when the text has no such placeholder.
 */
export function splitMessage(text: string, name: string): readonly [string, string] | null {
  const token = `{${name}}`;
  const index = text.indexOf(token);
  if (index < 0) {
    return null;
  }
  return [text.slice(0, index), text.slice(index + token.length)];
}

/**
 * Fills every `{name}` placeholder of a catalog template. Placeholders without a value stay as
 * written, so a missing argument is visible instead of silently empty.
 */
export function formatMessage(template: string, values?: MessageValues): string {
  if (!values) {
    return template;
  }
  return template.replace(messagePlaceholderPattern(), (token, name: string) => {
    const value = values[name];
    return value === undefined ? token : String(value);
  });
}
