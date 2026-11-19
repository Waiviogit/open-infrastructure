import { contractDisplayLabel, shortenId } from './contract-label';

describe('contractDisplayLabel', () => {
  it('uses the offer name and version', () => {
    expect(
      contractDisplayLabel({
        contract_id: 'contract-offer-1-alice-bob',
        offer_name: 'Logo design',
        offer_version: 3,
      }),
    ).toBe('Logo design · v3');
  });

  it('tells apart contracts that share the `contract-` prefix', () => {
    const a = contractDisplayLabel({
      contract_id: 'contract-offer-aaaa-alice-bob',
      offer_name: 'A',
    });
    const b = contractDisplayLabel({
      contract_id: 'contract-offer-bbbb-alice-bob',
      offer_name: 'B',
    });
    expect(a).not.toBe(b);
  });

  it('falls back to a shortened id without an offer name', () => {
    expect(
      contractDisplayLabel({
        contract_id: 'contract-offer-9f8e7d6c-alice-carol',
        offer_name: ' ',
      }),
    ).toBe('contract-o…-carol');
  });
});

describe('shortenId', () => {
  it('keeps short ids and middle-truncates long ones', () => {
    expect(shortenId('inv-1')).toBe('inv-1');
    expect(shortenId('inv-3f2a6b8c-1d2e-4f5a-9b0c-7d8e9f0a1b2c')).toBe(
      'inv-3f2a6b…0a1b2c',
    );
  });
});
