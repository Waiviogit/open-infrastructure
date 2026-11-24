import type { locales } from '../config/locales';
import type enUS from '../locales/en-US.json';

export type LocaleConfig = (typeof locales)[number];
export type LocaleId = LocaleConfig['id'];

/** Any key of the reference catalog (en-US). `t()` accepts only these. */
export type MessageKey = keyof typeof enUS;

/** A catalog as stored on disk or passed in tests — may lack keys. */
export type Messages = Readonly<Record<string, string>>;

/** A loaded catalog: every en-US key is present (other locales fall back to en-US text). */
export type CatalogMessages = Readonly<Record<MessageKey, string>>;

/** Values for `{name}` placeholders; a numeric `count` also selects the plural form. */
export type MessageValues = Readonly<Record<string, string | number>>;

/**
 * Plural messages: `base` when en-US has both `base_one` and `base_other` (CLDR suffixes,
 * i18next v4 layout). `t(base, { count })` picks the form for the active locale.
 */
export type PluralMessageKey = {
  [K in MessageKey]: K extends `${infer Base}_other`
    ? `${Base}_one` extends MessageKey
      ? Base
      : never
    : never;
}[MessageKey];

export type Translate = {
  (key: MessageKey, values?: MessageValues): string;
  (key: PluralMessageKey, values: MessageValues & { readonly count: number }): string;
};
