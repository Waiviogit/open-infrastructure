import { killPort } from '@nx/node/utils';

import { resolveE2ePort } from './e2e-env';

const STOP_GRACE_MS = 5_000;

module.exports = async function () {
  const proc = globalThis.__QUERY_API_PROC__;
  if (proc && proc.exitCode === null) {
    proc.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (proc.exitCode === null) {
          proc.kill('SIGKILL');
        }
        resolve();
      }, STOP_GRACE_MS);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await killPort(resolveE2ePort()).catch(() => undefined);
};
