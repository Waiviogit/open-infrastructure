'use strict';

/**
 * Adds message keys with translations to every web locale catalog
 * (apps/web/src/i18n/locales/*.json). Strict UTF-8 read (TextDecoder fatal), BOM-free write,
 * same 2-space JSON formatting as the catalogs.
 *
 * Input file (JSON):
 *   {
 *     "after": "business_record_payment",          // optional anchor key; new keys go right after it
 *     "keys": {
 *       "business_pay_title": { "en-US": "Pay", "ru-RU": "Оплатить", ... },
 *       "messaging_members_count": {               // plural message: an object of CLDR forms
 *         "en-US": { "one": "{count} member", "other": "{count} members" },
 *         "ru-RU": { "one": "{count} участник", "few": "{count} участника", "many": "{count} участников", "other": "{count} участника" },
 *         ...
 *       }
 *     }
 *   }
 *
 * A plural message is stored as `<key>_<category>` keys (i18next v4 layout, read by `t(key, { count })`).
 * Each locale must give exactly its CLDR categories (`Intl.PluralRules`); an optional `zero` form
 * (used for a count of 0) is allowed everywhere and, when en-US has one, required everywhere.
 *
 * Rules:
 *   - every key must have a translation for every locale file (fails otherwise);
 *   - plain values: `{placeholder}` sets must match en-US; plural forms may drop placeholders but
 *     must not use ones that no en-US form has;
 *   - keys already present in a catalog are left untouched unless --overwrite, which replaces
 *     their values in place (catalog order is kept; only new keys go after the anchor). With
 *     --overwrite a plural message also drops `<key>_<category>` forms the locale no longer gets.
 *
 * Usage (repo root):
 *   pnpm i18n:add-keys path/to/keys.json [--overwrite] [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales');
const REFERENCE_LOCALE = 'en-US';
const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const ZERO_CATEGORY = 'zero';

function readUtf8Json(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    throw new Error(`${filePath}: UTF-8 BOM is not allowed`);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf));
}

function writeUtf8Json(filePath, value) {
  fs.writeFileSync(filePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));
}

function placeholderList(text) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

function placeholders(text) {
  return placeholderList(text).sort().join(',');
}

function isPlural(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inserts each entry after its anchor key; entries whose anchor is absent go to the end. */
function insertAfterAnchors(catalog, entries) {
  const byAnchor = new Map();
  const tail = [];
  for (const entry of entries) {
    const [, , anchor] = entry;
    if (anchor && anchor in catalog) byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), entry]);
    else tail.push(entry);
  }
  const out = {};
  for (const [key, value] of Object.entries(catalog)) {
    out[key] = value;
    for (const [newKey, newValue] of byAnchor.get(key) ?? []) out[newKey] = newValue;
  }
  for (const [newKey, newValue] of tail) out[newKey] = newValue;
  return out;
}

/** New plural forms go next to existing forms of the same message; everything else after `after`. */
function anchorFor(key, base, catalog, after) {
  if (!base) return after;
  const siblings = PLURAL_CATEGORIES.map((cat) => `${base}_${cat}`).filter((k) => k !== key && k in catalog);
  return siblings.length > 0 ? siblings[siblings.length - 1] : after;
}

function validatePlain(key, translations, locales, errors) {
  const reference = translations[REFERENCE_LOCALE];
  for (const locale of locales) {
    const text = translations[locale];
    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`${key}: missing ${locale}`);
    } else if (placeholders(text) !== placeholders(reference)) {
      errors.push(`${key}: ${locale} placeholders {${placeholders(text)}} != en-US {${placeholders(reference)}}`);
    }
  }
}

function validatePlural(key, translations, locales, errors) {
  const reference = translations[REFERENCE_LOCALE];
  const referencePlaceholders = new Set(Object.values(reference).flatMap((text) => placeholderList(String(text))));
  const zeroRequired = ZERO_CATEGORY in reference;
  for (const locale of locales) {
    const forms = translations[locale];
    if (!isPlural(forms)) {
      errors.push(`${key}: ${locale} must be an object of plural forms like en-US`);
      continue;
    }
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    const required = zeroRequired ? [...new Set([...categories, ZERO_CATEGORY])] : categories;
    const allowed = new Set([...categories, ZERO_CATEGORY]);
    const missing = required.filter((cat) => typeof forms[cat] !== 'string' || forms[cat].trim() === '');
    const extra = Object.keys(forms).filter((cat) => !allowed.has(cat));
    if (missing.length > 0) errors.push(`${key}: ${locale} lacks plural forms ${missing.join(', ')}`);
    if (extra.length > 0) errors.push(`${key}: ${locale} has forms it does not use: ${extra.join(', ')}`);
    for (const [cat, text] of Object.entries(forms)) {
      const added = placeholderList(String(text)).filter((p) => !referencePlaceholders.has(p));
      if (added.length > 0) errors.push(`${key}: ${locale}.${cat} adds placeholders {${added.join('}, {')}}`);
    }
  }
}

function validate(spec, locales) {
  const errors = [];
  if (!spec || typeof spec.keys !== 'object' || spec.keys === null) {
    return ['input must be { "after"?: string, "keys": { [key]: { [locale]: string | { [category]: string } } } }'];
  }
  for (const [key, translations] of Object.entries(spec.keys)) {
    const reference = translations?.[REFERENCE_LOCALE];
    if (typeof reference === 'string') {
      validatePlain(key, translations, locales, errors);
    } else if (isPlural(reference)) {
      validatePlural(key, translations, locales, errors);
    } else {
      errors.push(`${key}: missing ${REFERENCE_LOCALE}`);
      continue;
    }
    for (const locale of Object.keys(translations)) {
      if (!locales.includes(locale)) errors.push(`${key}: unknown locale ${locale}`);
    }
  }
  return errors;
}

/** Catalog entries and stale plural keys for one locale. */
function localeEntries(spec, locale) {
  const entries = [];
  const stale = new Set();
  for (const [key, translations] of Object.entries(spec.keys)) {
    const value = translations[locale];
    if (!isPlural(value)) {
      entries.push([key, value, null]);
      continue;
    }
    for (const cat of PLURAL_CATEGORIES) {
      if (typeof value[cat] === 'string') entries.push([`${key}_${cat}`, value[cat], key]);
      else stale.add(`${key}_${cat}`);
    }
  }
  return { entries, stale };
}

function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith('--'));
  const overwrite = args.includes('--overwrite');
  const dryRun = args.includes('--dry-run');
  if (!inputPath) {
    console.error('Usage: pnpm i18n:add-keys <keys.json> [--overwrite] [--dry-run]');
    process.exit(2);
  }

  const spec = readUtf8Json(path.resolve(inputPath));
  const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort();
  const locales = files.map((f) => f.replace(/\.json$/, ''));

  const errors = validate(spec, locales);
  if (errors.length > 0) {
    console.error(`i18n:add-keys: ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }

  for (const file of files) {
    const locale = file.replace(/\.json$/, '');
    const filePath = path.join(LOCALES_DIR, file);
    const catalog = readUtf8Json(filePath);
    const { entries, stale } = localeEntries(spec, locale);
    const values = new Map(entries.map(([key, value]) => [key, value]));
    const pending = entries.filter(([key]) => !(key in catalog));
    let updated = 0;
    let removed = 0;
    // --overwrite replaces existing values in place, so catalog order (and the diff) stays stable.
    const base = overwrite
      ? Object.fromEntries(
          Object.entries(catalog).flatMap(([key, value]) => {
            if (stale.has(key)) {
              removed += 1;
              return [];
            }
            if (!values.has(key)) return [[key, value]];
            const next = values.get(key);
            if (next !== value) updated += 1;
            return [[key, next]];
          }),
        )
      : catalog;
    const added = pending.map(([key, value, pluralBase]) => [key, value, anchorFor(key, pluralBase, base, spec.after)]);
    const next = insertAfterAnchors(base, added);
    if (!dryRun) writeUtf8Json(filePath, next);
    const changes = overwrite ? ` ~${updated}${removed > 0 ? ` -${removed}` : ''}` : '';
    console.log(`${locale}: +${added.length}${changes}${dryRun ? ' (dry run)' : ''}`);
  }
}

main();
