'use strict';

/**
 * Lists en-US message keys of the web catalogs (apps/web/src/i18n/locales) that no source file
 * references. Report only — remove the keys with `pnpm i18n:remove-keys --from-file <file>`, then
 * run `pnpm typecheck:web` (typed `t()` fails on a key that is still used) and the web tests.
 *
 * A key counts as used when any .ts/.tsx/.js file under apps/web/src or libs/ (specs included):
 *   - contains it as a quoted literal ('key', "key", `key`) or reads it as `messages.key`;
 *   - builds it from a template with a literal prefix (`prefix_${x}` keeps every `prefix_*` key)
 *     or a literal suffix (`${base}_count` keeps `<literal>_count`);
 *   - names its plural base (`base` keeps `base_one`, `base_other`, …).
 *
 * Usage (repo root):
 *   pnpm i18n:unused [--prefix <p>] [--out <file>]
 *     --prefix  only keys starting with <p>
 *     --out     write the keys one per line (input for i18n:remove-keys --from-file)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REFERENCE_CATALOG = path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'locales', 'en-US.json');
const SOURCE_DIRS = [path.join(ROOT, 'apps', 'web', 'src'), path.join(ROOT, 'libs')];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'out-tsc', 'locales']);
const SOURCE_FILE = /\.(tsx?|jsx?|cjs|mjs)$/;
const TEMPLATE_PREFIX = /`([A-Za-z][\w.-]*_)\$\{/g;
const TEMPLATE_SUFFIX = /\$\{[^}`]+\}(_[A-Za-z0-9_]+)`/g;
const MESSAGES_PROPERTY = /\bmessages\??\.([A-Za-z0-9_]+)/g;
const PLURAL_SUFFIX = /^(.+)_(zero|one|two|few|many|other)$/;
const MIN_PREFIX_LENGTH = 3;
const GROUP_PREVIEW = 8;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (SOURCE_FILE.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function quotedLiterals(source) {
  const literals = new Set();
  for (const match of source.matchAll(/(['"`])([A-Za-z0-9][A-Za-z0-9_.-]*)\1/g)) literals.add(match[2]);
  return literals;
}

function parseArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return { prefix: value('--prefix') ?? '', out: value('--out') };
}

function main() {
  const { prefix, out } = parseArgs(process.argv.slice(2));
  const reference = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(REFERENCE_CATALOG)),
  );

  const literals = new Set();
  const templatePrefixes = new Set();
  const templateSuffixes = new Set();
  for (const file of SOURCE_DIRS.flatMap((dir) => walk(dir, []))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const literal of quotedLiterals(source)) literals.add(literal);
    for (const match of source.matchAll(MESSAGES_PROPERTY)) literals.add(match[1]);
    for (const match of source.matchAll(TEMPLATE_PREFIX)) {
      if (match[1].length >= MIN_PREFIX_LENGTH) templatePrefixes.add(match[1]);
    }
    for (const match of source.matchAll(TEMPLATE_SUFFIX)) templateSuffixes.add(match[1]);
  }

  const isReferenced = (key) => {
    if (literals.has(key)) return true;
    for (const p of templatePrefixes) if (key.startsWith(p)) return true;
    // `${base}_suffix` where `base` is itself a literal somewhere (e.g. a typed prefix union)
    for (const s of templateSuffixes) if (key.endsWith(s) && literals.has(key.slice(0, -s.length))) return true;
    return false;
  };
  // A plural form is used when its base is (`t(base, { count })`).
  const isUsed = (key) => {
    const plural = PLURAL_SUFFIX.exec(key);
    return isReferenced(key) || (plural !== null && isReferenced(plural[1]));
  };

  const unused = Object.keys(reference).filter((key) => key.startsWith(prefix) && !isUsed(key));

  const groups = new Map();
  for (const key of unused) {
    const group = key.split(/[_.-]/)[0];
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [group, keys] of sorted) {
    const more = keys.length > GROUP_PREVIEW ? `, … +${keys.length - GROUP_PREVIEW}` : '';
    console.log(`${group} (${keys.length}): ${keys.slice(0, GROUP_PREVIEW).join(', ')}${more}`);
  }
  console.log(`i18n:unused: ${unused.length} of ${Object.keys(reference).length} en-US keys look unused`);

  if (out) {
    fs.writeFileSync(out, Buffer.from(unused.length > 0 ? `${unused.join('\n')}\n` : '', 'utf8'));
    console.log(`i18n:unused: wrote ${unused.length} key(s) to ${out}`);
  }
}

main();
