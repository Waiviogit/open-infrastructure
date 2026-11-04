'use strict';

/**
 * CI / local guard: every `@opden-data-layer/*` alias in apps/web/tsconfig.json must also exist in
 * tsconfig.base.json and resolve to the same file. `tsc` for web reads the web paths while Jest
 * (Nx preset) and other projects read the base paths, so a one-sided alias only fails later.
 *
 * Usage (repo root):
 *   pnpm check:web-tsconfig-paths
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_TSCONFIG = path.join(ROOT, 'tsconfig.base.json');
const WEB_TSCONFIG = path.join(ROOT, 'apps', 'web', 'tsconfig.json');
const ALIAS_PREFIX = '@opden-data-layer/';

function readPaths(filePath) {
  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const options = config.compilerOptions ?? {};
  const baseUrl = path.resolve(path.dirname(filePath), options.baseUrl ?? '.');
  const out = new Map();
  for (const [alias, targets] of Object.entries(options.paths ?? {})) {
    if (!alias.startsWith(ALIAS_PREFIX)) continue;
    out.set(alias, targets.map((t) => path.normalize(path.resolve(baseUrl, t))));
  }
  return out;
}

function main() {
  const base = readPaths(BASE_TSCONFIG);
  const web = readPaths(WEB_TSCONFIG);
  const problems = [];

  for (const [alias, webTargets] of web) {
    const baseTargets = base.get(alias);
    if (!baseTargets) {
      problems.push(`${alias}: in apps/web/tsconfig.json but missing in tsconfig.base.json`);
      continue;
    }
    if (webTargets.join('|') !== baseTargets.join('|')) {
      const rel = (targets) => targets.map((t) => path.relative(ROOT, t)).join(', ');
      problems.push(`${alias}: web → ${rel(webTargets)} but base → ${rel(baseTargets)}`);
    }
  }

  if (problems.length > 0) {
    console.error(`check:web-tsconfig-paths: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`check:web-tsconfig-paths: OK (${web.size} aliases match tsconfig.base.json)`);
}

main();
