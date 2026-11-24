const ZERO_SUFFIX = 'zero';
const OTHER_SUFFIX = 'other';

const rulesByLocale = new Map<string, Intl.PluralRules>();

function pluralRules(locale: string): Intl.PluralRules {
  const cached = rulesByLocale.get(locale);
  if (cached) {
    return cached;
  }
  const rules = new Intl.PluralRules(locale);
  rulesByLocale.set(locale, rules);
  return rules;
}

/**
 * Catalog keys to try, in order, for a plural message `base` (CLDR suffixes, i18next v4 layout):
 * `base_zero` when the count is 0, then `base_<CLDR category of count>`, then `base_other`.
 */
export function pluralKeyCandidates(base: string, count: number, locale: string): string[] {
  const candidates = [`${base}_${pluralRules(locale).select(count)}`, `${base}_${OTHER_SUFFIX}`];
  if (count === 0) {
    candidates.unshift(`${base}_${ZERO_SUFFIX}`);
  }
  return [...new Set(candidates)];
}
