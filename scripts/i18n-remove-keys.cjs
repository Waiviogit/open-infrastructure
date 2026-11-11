'use strict';

/**
 * Removes message keys from every web locale catalog (apps/web/src/i18n/locales/*.json).
 * Strict UTF-8 read (TextDecoder fatal), BOM-free write, same 2-space JSON formatting as the
 * catalogs — the I/O contract of scripts/i18n-add-keys.cjs.
 *
 * Grep the web app for each key before removing it: only drop keys no code uses any more.
 *
 * Usage (repo root):
 *   pnpm i18n:remove-keys <key> [<key> ...] [--dry-run]
 *
 * Fails when a key is missing from every catalog (likely a typo); a key missing from only
 * some catalogs is reported and removed where present.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales');

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

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const keys = [...new Set(args.filter((a) => !a.startsWith('--')))];
  if (keys.length === 0) {
    console.error('Usage: pnpm i18n:remove-keys <key> [<key> ...] [--dry-run]');
    process.exit(2);
  }

  const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort();
  const catalogs = files.map((file) => {
    const filePath = path.join(LOCALES_DIR, file);
    return { locale: file.replace(/\.json$/, ''), filePath, catalog: readUtf8Json(filePath) };
  });

  const unknown = keys.filter((key) => catalogs.every(({ catalog }) => !(key in catalog)));
  if (unknown.length > 0) {
    console.error(`i18n:remove-keys: not found in any catalog: ${unknown.join(', ')}`);
    process.exit(1);
  }

  for (const { locale, filePath, catalog } of catalogs) {
    const present = keys.filter((key) => key in catalog);
    const missing = keys.filter((key) => !(key in catalog));
    const next = Object.fromEntries(Object.entries(catalog).filter(([key]) => !keys.includes(key)));
    if (!dryRun && present.length > 0) writeUtf8Json(filePath, next);
    const note = missing.length > 0 ? ` (missing: ${missing.join(', ')})` : '';
    console.log(`${locale}: -${present.length}${note}${dryRun ? ' (dry run)' : ''}`);
  }
}

main();
