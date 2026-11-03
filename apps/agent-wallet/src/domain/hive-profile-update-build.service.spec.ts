import { HiveProfileUpdateBuildService } from './hive-profile-update-build.service';
import type { HiveChainContextService } from './hive-chain-context.service';
import type { LocalKeysService } from './local-keys.service';

describe('HiveProfileUpdateBuildService', () => {
  const getAccount = jest.fn();
  const chainContext = { getAccount } as unknown as HiveChainContextService;

  const hasAccount = jest.fn();
  const getReadiness = jest.fn();
  const localKeys = { hasAccount, getReadiness } as unknown as LocalKeysService;

  const config = { get: jest.fn().mockReturnValue('local') };

  const neoSnapshot = {
    name: 'neo.agent',
    memo_key: 'STM6HhfiYyrZhLwM7AGCJgR2PbnUxmmednYZ2Vt4AgDExVGFwveLB',
    json_metadata: '',
    posting_json_metadata: JSON.stringify({
      profile: { name: 'Neo', about: 'Grok agent', version: 2 },
    }),
    posting: { weight_threshold: 1, account_auths: [], key_auths: [] },
  };

  let service: HiveProfileUpdateBuildService;

  beforeEach(() => {
    jest.clearAllMocks();
    getAccount.mockResolvedValue(neoSnapshot);
    hasAccount.mockReturnValue(true);
    getReadiness.mockReturnValue({ postingReady: true });
    service = new HiveProfileUpdateBuildService(config as never, chainContext, localKeys);
  });

  it('builds account_update2 that sets profile_image and keeps existing fields', async () => {
    const result = await service.buildProfileUpdate({
      account: '@neo.agent',
      profile: { profile_image: 'https://ipfs.example/ipfs/avatar' },
    });

    expect(result.keyType).toBe('posting');
    expect(result.canSignLocally).toBe(true);
    expect(result.changedFields).toEqual(['profile_image']);
    expect(result.ops).toHaveLength(1);

    const [opName, payload] = result.ops[0];
    expect(opName).toBe('account_update2');
    expect(payload['json_metadata']).toBe('');
    expect(JSON.parse(payload['posting_json_metadata'] as string)).toEqual({
      profile: {
        name: 'Neo',
        about: 'Grok agent',
        version: 2,
        profile_image: 'https://ipfs.example/ipfs/avatar',
      },
    });
  });

  it('returns no ops when the profile already has the requested values', async () => {
    const result = await service.buildProfileUpdate({
      account: 'neo.agent',
      profile: { name: 'Neo' },
    });

    expect(result.ops).toEqual([]);
    expect(result.warnings[0]).toContain('nothing to broadcast');
  });

  it('marks payload-only when the account is not in the local registry', async () => {
    hasAccount.mockReturnValue(false);

    const result = await service.buildProfileUpdate({
      account: 'neo.agent',
      profile: { cover_image: 'https://img.example/cover.png' },
    });

    expect(result.canSignLocally).toBe(false);
    expect(result.warnings.some((w) => w.includes('has_broadcast'))).toBe(true);
  });

  it('throws when the account does not exist', async () => {
    getAccount.mockResolvedValue(null);

    await expect(
      service.buildProfileUpdate({ account: 'ghost', profile: { name: 'x' } }),
    ).rejects.toThrow('Hive account not found: ghost');
  });
});
