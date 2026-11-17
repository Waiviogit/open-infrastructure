import {
  canCreateServiceOrderOnContract,
  compactServiceOrderDetails,
} from './service-order-create';

describe('canCreateServiceOrderOnContract', () => {
  it('keeps contracts with an active offer', () => {
    expect(canCreateServiceOrderOnContract({ offer_status: 'active' })).toBe(true);
  });

  it('drops contracts whose offer is retired', () => {
    expect(canCreateServiceOrderOnContract({ offer_status: 'retired' })).toBe(false);
  });

  it('keeps contracts when offer_status is omitted', () => {
    expect(canCreateServiceOrderOnContract({})).toBe(true);
  });
});

describe('compactServiceOrderDetails', () => {
  it('drops the blank fields the schema prefill leaves untouched', () => {
    expect(
      compactServiceOrderDetails({
        source: 'follow',
        checks: 1000,
        objectIds: [],
        account: '',
      }),
    ).toEqual({ source: 'follow', checks: 1000 });
  });

  it('drops whitespace-only strings, null, and blank array entries', () => {
    expect(
      compactServiceOrderDetails({
        note: '   ',
        parent: null,
        objectIds: ['obj-1', '', '  ', null],
      }),
    ).toEqual({ objectIds: ['obj-1'] });
  });

  it('keeps false and zero, which are deliberate values', () => {
    expect(compactServiceOrderDetails({ urgent: false, retries: 0 })).toEqual({
      urgent: false,
      retries: 0,
    });
  });

  it('compacts nested objects and drops them when nothing is left', () => {
    expect(
      compactServiceOrderDetails({
        target: { account: '', tags: [] },
        filter: { platform: 'linkedin', since: '' },
      }),
    ).toEqual({ filter: { platform: 'linkedin' } });
  });

  it('returns undefined when every field is blank', () => {
    expect(compactServiceOrderDetails({ account: '', objectIds: [] })).toBeUndefined();
    expect(compactServiceOrderDetails({})).toBeUndefined();
  });

  it('keeps filled strings unchanged', () => {
    expect(compactServiceOrderDetails({ account: ' alice ' })).toEqual({
      account: ' alice ',
    });
  });
});
