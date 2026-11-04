'use strict';

/**
 * Runs the query-api e2e suite against the disposable test stack from docker-compose.test.yml
 * (Postgres `test` on 55432, Redis on 56379) and always tears the stack down, also on failure.
 *
 * Usage (repo root):
 *   pnpm e2e:query-api
 */

const { spawnSync } = require('child_process');

function run(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status ?? 1;
}

function main() {
  const upStatus = run(['test:db:up']);
  if (upStatus !== 0) {
    run(['test:db:down']);
    process.exit(upStatus);
  }

  const e2eStatus = run(['nx', 'e2e', 'query-api-e2e']);
  const downStatus = run(['test:db:down']);
  process.exit(e2eStatus !== 0 ? e2eStatus : downStatus);
}

main();
