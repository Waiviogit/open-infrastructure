import {
  buildAccountUpdate2ProfileOp,
  mergeHiveProfileMetadata,
  parseHiveAccountMetadata,
} from './hive-account-profile-operations';

describe('parseHiveAccountMetadata', () => {
  it('returns empty object for empty, invalid, or non-object JSON', () => {
    expect(parseHiveAccountMetadata('')).toEqual({});
    expect(parseHiveAccountMetadata('{not json')).toEqual({});
    expect(parseHiveAccountMetadata('[1,2]')).toEqual({});
  });

  it('drops prototype-polluting keys', () => {
    const parsed = parseHiveAccountMetadata('{"__proto__":{"x":1},"a":1}');
    expect(parsed).toEqual({ a: 1 });
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('mergeHiveProfileMetadata', () => {
  it('sets profile_image and keeps other profile and top-level keys', () => {
    const result = mergeHiveProfileMetadata({
      postingJsonMetadata: JSON.stringify({
        profile: { name: 'Neo', about: 'Agent', version: 2 },
        beneficiaries: [],
      }),
      jsonMetadata: '',
      patch: { profile_image: 'https://ipfs.example/ipfs/cid' },
    });

    expect(JSON.parse(result.postingJsonMetadata)).toEqual({
      profile: {
        name: 'Neo',
        about: 'Agent',
        version: 2,
        profile_image: 'https://ipfs.example/ipfs/cid',
      },
      beneficiaries: [],
    });
    expect(result.changedFields).toEqual(['profile_image']);
  });

  it('seeds the profile from json_metadata when posting metadata has none', () => {
    const result = mergeHiveProfileMetadata({
      postingJsonMetadata: '',
      jsonMetadata: JSON.stringify({ profile: { name: 'Legacy' } }),
      patch: { cover_image: 'https://img.example/cover.png' },
    });

    expect(result.previousProfile).toEqual({ name: 'Legacy' });
    expect(result.profile).toEqual({
      name: 'Legacy',
      cover_image: 'https://img.example/cover.png',
      version: 2,
    });
  });

  it('removes a field on null and reports no change for equal values', () => {
    const result = mergeHiveProfileMetadata({
      postingJsonMetadata: JSON.stringify({
        profile: { name: 'Neo', location: 'Matrix' },
      }),
      jsonMetadata: '',
      patch: { name: 'Neo', location: null },
    });

    expect(result.profile).toEqual({ name: 'Neo', version: 2 });
    expect(result.changedFields).toEqual(['location']);
  });
});

describe('buildAccountUpdate2ProfileOp', () => {
  it('builds a posting-only account_update2 wire tuple', () => {
    const op = buildAccountUpdate2ProfileOp({
      account: '@Neo.Agent',
      postingJsonMetadata: '{"profile":{"version":2}}',
    });

    expect(op).toEqual([
      'account_update2',
      {
        account: 'neo.agent',
        json_metadata: '',
        posting_json_metadata: '{"profile":{"version":2}}',
        extensions: [],
      },
    ]);
    expect(op[1]).not.toHaveProperty('memo_key');
    expect(op[1]).not.toHaveProperty('posting');
  });

  it('rejects empty metadata', () => {
    expect(() =>
      buildAccountUpdate2ProfileOp({ account: 'neo', postingJsonMetadata: ' ' }),
    ).toThrow('postingJsonMetadata must not be empty');
  });
});
