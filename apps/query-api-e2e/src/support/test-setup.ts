import { resolveE2eBaseUrl } from './e2e-env';

process.env['E2E_BASE_URL'] = resolveE2eBaseUrl();
