import * as enUS from '../locales/en-US.json';
import * as ruRU from '../locales/ru-RU.json';
import { locales } from '../config/locales';
import type { Messages } from '../types';
import { loadMessages } from './load-messages';

const EN_KEYS = Object.keys(enUS).filter((key) => key !== 'default');

describe('loadMessages', () => {
  it.each(locales.map((l) => l.id))('%s has a text for every en-US key', async (locale) => {
    const messages: Messages = await loadMessages(locale);
    const missing = EN_KEYS.filter((key) => typeof messages[key] !== 'string');
    expect(missing).toEqual([]);
  });

  it('keeps the locale text over the en-US fallback', async () => {
    const messages = await loadMessages('ru-RU');
    expect(messages.show_more).toBe((ruRU as Record<string, string>).show_more);
    expect(messages.show_more).not.toBe((enUS as Record<string, string>).show_more);
  });

  it('returns the same catalog object on repeat loads', async () => {
    expect(await loadMessages('de-DE')).toBe(await loadMessages('de-DE'));
  });
});
