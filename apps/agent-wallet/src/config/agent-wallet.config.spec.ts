import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('agent-wallet config factory', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('sets defaultAccount to the first registry entry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-wallet-config-'));
    const accountsFile = join(dir, 'accounts.json');
    writeFileSync(
      accountsFile,
      JSON.stringify([
        { account: 'alice', keys: { posting: '5Ja' } },
        { account: 'bob', keys: { posting: '5Jb' } },
      ]),
    );

    process.env = {
      ...originalEnv,
      AGENT_WALLET_ACCOUNTS_FILE: accountsFile,
      HIVE_ACCOUNT: undefined,
      HIVE_POSTING_KEY: undefined,
    };

    const configModule = await import('./agent-wallet.config');
    const config = configModule.default();

    expect(config.defaultAccount).toBe('alice');
    expect(config.accounts[0]?.account).toBe('alice');
    expect(config.accountsSource).toBe('file');
  });

  it('defaults query-api and web origins to WAIVIO_API_ORIGIN unless overridden', async () => {
    process.env = {
      ...originalEnv,
      WAIVIO_API_ORIGIN: 'https://api.example',
      QUERY_API_ORIGIN: undefined,
      WAIVIO_WEB_ORIGIN: 'https://web.example',
    };

    const configModule = await import('./agent-wallet.config');
    const config = configModule.default();

    expect(config.queryApiOrigin).toBe('https://api.example');
    expect(config.webOrigin).toBe('https://web.example');
  });
});
