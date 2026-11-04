'use strict';

/**
 * Runs ESLint only on changed source files, so pre-existing lint errors elsewhere in a project
 * do not hide (or block on) problems introduced by the current change.
 *
 * Changed = files differing from the merge-base with --base, plus uncommitted and untracked
 * files. Deleted files are skipped. Default base: the current branch's upstream (`@{u}`), or
 * origin/development when the branch has no upstream (day-to-day work branches off development).
 *
 * Usage (repo root):
 *   pnpm lint:changed                 # vs upstream (or origin/development) + working tree
 *   pnpm lint:changed --base origin/master
 *   pnpm lint:changed --base HEAD     # only uncommitted / untracked changes
 *   pnpm lint:changed --fix
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FALLBACK_BASE = 'origin/development';
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function defaultBase() {
  try {
    return git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])[0] ?? FALLBACK_BASE;
  } catch {
    return FALLBACK_BASE;
  }
}

function parseArgs(argv) {
  const baseIndex = argv.indexOf('--base');
  const base = baseIndex >= 0 ? argv[baseIndex + 1] : defaultBase();
  if (!base || base.startsWith('--')) {
    console.error('lint:changed: --base requires a git ref');
    process.exit(2);
  }
  const passthrough =
    baseIndex >= 0 ? argv.filter((_arg, i) => i !== baseIndex && i !== baseIndex + 1) : argv;
  return { base, passthrough };
}

function main() {
  const { base, passthrough } = parseArgs(process.argv.slice(2));
  const mergeBase = base === 'HEAD' ? 'HEAD' : git(['merge-base', base, 'HEAD'])[0];

  const files = new Set([
    ...git(['diff', '--name-only', '--diff-filter=d', mergeBase]),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ]);
  const targets = [...files]
    .filter((file) => LINTABLE.test(file))
    .filter((file) => fs.existsSync(path.join(ROOT, file)));

  if (targets.length === 0) {
    console.log(`lint:changed: no changed lintable files vs ${base}`);
    return;
  }

  console.log(`lint:changed: ${targets.length} file(s) vs ${base}`);
  const result = spawnSync('pnpm', ['exec', 'eslint', '--no-warn-ignored', ...passthrough, ...targets], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(result.status ?? 1);
}

main();
