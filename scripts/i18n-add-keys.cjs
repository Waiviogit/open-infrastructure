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
 *       ...
 *     }
 *   }
 *
 * Rules:
 *   - every key must have a translation for every locale file (fails otherwise);
 *   - `{placeholder}` sets must match en-US in every locale;
 *   - keys already present in a catalog are left untouched unless --overwrite.
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

function placeholders(text) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).sort().join(',');
}

function insertAfter(catalog, anchor, entries) {
  if (!anchor || !(anchor in catalog)) {
    return { ...catalog, ...Object.fromEntries(entries) };
  }
  const out = {};
  for (const [key, value] of Object.entries(catalog)) {
    out[key] = value;
    if (key === anchor) {
      for (const [newKey, newValue] of entries) out[newKey] = newValue;
    }
  }
  return out;
}

function validate(spec, locales) {
  const errors = [];
  if (!spec || typeof spec.keys !== 'object' || spec.keys === null) {
    return ['input must be { "after"?: string, "keys": { [key]: { [locale]: string } } }'];
  }
  for (const [key, translations] of Object.entries(spec.keys)) {
    const reference = translations?.[REFERENCE_LOCALE];
    if (typeof reference !== 'string') {
      errors.push(`${key}: missing ${REFERENCE_LOCALE}`);
      continue;
    }
    for (const locale of locales) {
      const text = translations[locale];
      if (typeof text !== 'string' || text.trim() === '') {
        errors.push(`${key}: missing ${locale}`);
      } else if (placeholders(text) !== placeholders(reference)) {
        errors.push(`${key}: ${locale} placeholders {${placeholders(text)}} != en-US {${placeholders(reference)}}`);
      }
    }
    for (const locale of Object.keys(translations)) {
      if (!locales.includes(locale)) errors.push(`${key}: unknown locale ${locale}`);
    }
  }
  return errors;
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
    const entries = Object.entries(spec.keys)
      .filter(([key]) => overwrite || !(key in catalog))
      .map(([key, translations]) => [key, translations[locale]]);
    const base = overwrite
      ? Object.fromEntries(Object.entries(catalog).filter(([key]) => !(key in spec.keys)))
      : catalog;
    const next = insertAfter(base, spec.after, entries);
    if (!dryRun) writeUtf8Json(filePath, next);
    console.log(`${locale}: +${entries.length}${dryRun ? ' (dry run)' : ''}`);
  }
}

main();
