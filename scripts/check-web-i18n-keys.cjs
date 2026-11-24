'use strict';

/**
 * CI / local guard for the web message catalogs (apps/web/src/i18n/locales/*.json). en-US is the
 * reference catalog:
 *   - every key matches KEY_PATTERN (ASCII, no spaces or punctuation);
 *   - every locale has every en-US key, and no key that en-US lacks;
 *   - every value uses the same `{placeholder}` set as en-US and has no stray `{` / `}`;
 *   - plural groups (`<base>_one` + `<base>_other` in en-US) carry exactly the CLDR plural
 *     categories of each locale (`Intl.PluralRules`), plus `_zero` wherever en-US has one.
 *     Plural forms may drop placeholders (e.g. "one item") but must not add new ones.
 * Values still identical to en-US are reported as a warning count (`--verbose` lists them).
 *
 * Usage (repo root):
 *   pnpm check:web-i18n-keys [--verbose]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales');
const REFERENCE_LOCALE = 'en-US';
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const ZERO_CATEGORY = 'zero';
const PREVIEW_LIMIT = 10;

function readUtf8Json(filePath) {
  const buf = fs.readFileSync(filePath);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf));
}

function placeholderSet(text) {
  return new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]));
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function preview(items, verbose) {
  const shown = verbose ? items : items.slice(0, PREVIEW_LIMIT);
  const rest = items.length - shown.length;
  return `${shown.join(', ')}${rest > 0 ? `, … +${rest} (--verbose)` : ''}`;
}

/** Plural groups of the reference catalog: base → forms present in en-US. */
function pluralGroups(reference) {
  const groups = new Map();
  for (const key of Object.keys(reference)) {
    const match = /^(.+)_other$/.exec(key);
    if (!match || !(`${match[1]}_one` in reference)) continue;
    const base = match[1];
    groups.set(
      base,
      PLURAL_CATEGORIES.filter((cat) => `${base}_${cat}` in reference),
    );
  }
  return groups;
}

function pluralMemberKeys(groups) {
  const members = new Set();
  for (const base of groups.keys()) {
    for (const cat of PLURAL_CATEGORIES) members.add(`${base}_${cat}`);
  }
  return members;
}

function checkPluralGroups(locale, catalog, reference, groups, problems) {
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  for (const [base, referenceForms] of groups) {
    const required = new Set(categories);
    if (referenceForms.includes(ZERO_CATEGORY)) required.add(ZERO_CATEGORY);
    const allowed = new Set([...categories, ZERO_CATEGORY]);
    const present = PLURAL_CATEGORIES.filter((cat) => `${base}_${cat}` in catalog);
    const missing = [...required].filter((cat) => !present.includes(cat));
    const extra = present.filter((cat) => !allowed.has(cat));
    if (missing.length > 0) problems.push(`${locale}: plural ${base} lacks ${missing.map((c) => `_${c}`).join(', ')}`);
    if (extra.length > 0) problems.push(`${locale}: plural ${base} has forms ${locale} does not use: ${extra.map((c) => `_${c}`).join(', ')}`);

    const referencePlaceholders = new Set(
      referenceForms.flatMap((cat) => [...placeholderSet(reference[`${base}_${cat}`])]),
    );
    for (const cat of present) {
      const added = [...placeholderSet(catalog[`${base}_${cat}`])].filter((p) => !referencePlaceholders.has(p));
      if (added.length > 0) problems.push(`${locale}: ${base}_${cat} adds placeholders {${added.join('}, {')}}`);
    }
  }
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort();
  const catalogs = new Map(files.map((f) => [f.replace(/\.json$/, ''), readUtf8Json(path.join(LOCALES_DIR, f))]));
  const reference = catalogs.get(REFERENCE_LOCALE);
  if (!reference) {
    console.error(`check:web-i18n-keys: ${REFERENCE_LOCALE}.json not found in ${LOCALES_DIR}`);
    process.exit(1);
  }

  const groups = pluralGroups(reference);
  const members = pluralMemberKeys(groups);
  const plainKeys = Object.keys(reference).filter((key) => !members.has(key));
  const problems = [];
  const warnings = [];

  for (const [locale, catalog] of catalogs) {
    const badKeys = Object.keys(catalog).filter((key) => !KEY_PATTERN.test(key));
    if (badKeys.length > 0) problems.push(`${locale}: invalid key names: ${badKeys.map((k) => JSON.stringify(k)).join(', ')}`);
    if (locale === REFERENCE_LOCALE) continue;

    const missing = plainKeys.filter((key) => !(key in catalog));
    if (missing.length > 0) problems.push(`${locale}: ${missing.length} key(s) missing: ${preview(missing, verbose)}`);

    const extra = Object.keys(catalog).filter((key) => !(key in reference) && !members.has(key));
    if (extra.length > 0) problems.push(`${locale}: ${extra.length} key(s) not in ${REFERENCE_LOCALE}: ${preview(extra, verbose)}`);

    const placeholderMismatch = plainKeys.filter(
      (key) => key in catalog && !sameSet(placeholderSet(catalog[key]), placeholderSet(reference[key])),
    );
    if (placeholderMismatch.length > 0) {
      problems.push(`${locale}: placeholders differ from ${REFERENCE_LOCALE}: ${preview(placeholderMismatch, verbose)}`);
    }

    const strayBraces = Object.keys(catalog).filter((key) => /[{}]/.test(catalog[key].replace(PLACEHOLDER, '')));
    if (strayBraces.length > 0) problems.push(`${locale}: stray { or } outside a {placeholder}: ${preview(strayBraces, verbose)}`);

    checkPluralGroups(locale, catalog, reference, groups, problems);

    const sameAsReference = plainKeys.filter((key) => catalog[key] === reference[key]);
    if (sameAsReference.length > 0) {
      warnings.push(`${locale}: ${sameAsReference.length}${verbose ? `: ${sameAsReference.join(', ')}` : ''}`);
    }
  }

  if (warnings.length > 0) {
    console.warn(`check:web-i18n-keys: values identical to ${REFERENCE_LOCALE} (brand names and cognates are fine):\n  ${warnings.join('\n  ')}`);
  }
  if (problems.length > 0) {
    console.error(`check:web-i18n-keys: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(
    `check:web-i18n-keys: OK (${catalogs.size} catalogs, ${Object.keys(reference).length} keys, ${groups.size} plural groups)`,
  );
}

main();
