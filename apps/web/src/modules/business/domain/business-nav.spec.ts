import {
  BUSINESS_NAV_ITEMS,
  businessNavIdForPath,
  businessNavItems,
  isBusinessPath,
} from './business-nav';

describe('businessNavIdForPath', () => {
  it('maps the catalog and its kinds to discover', () => {
    expect(businessNavIdForPath('/business')).toBe('discover');
    expect(businessNavIdForPath('/business/offers')).toBe('discover');
    expect(businessNavIdForPath('/business/requests')).toBe('discover');
  });

  it('maps owner pages by kind', () => {
    expect(businessNavIdForPath('/business/manage/offers/drafts')).toBe(
      'offers',
    );
    expect(
      businessNavIdForPath('/business/manage/offers/drafts/d-1/preview'),
    ).toBe('offers');
    expect(businessNavIdForPath('/business/manage/requests/retired')).toBe(
      'requests',
    );
  });

  it('keeps ledger drill-downs under relationships', () => {
    expect(businessNavIdForPath('/business/relationships/alice')).toBe(
      'relationships',
    );
    expect(businessNavIdForPath('/business/invoices/inv-1')).toBe(
      'relationships',
    );
    expect(businessNavIdForPath('/business/disputes/dispute-1')).toBe(
      'relationships',
    );
    expect(businessNavIdForPath('/business/pay')).toBe('relationships');
  });

  it('maps the dispute inboxes', () => {
    expect(businessNavIdForPath('/business/arbitration')).toBe('arbitration');
    expect(businessNavIdForPath('/business/dispute-resolution')).toBe(
      'dispute-resolution',
    );
  });

  it('ignores lookalike and foreign paths', () => {
    expect(businessNavIdForPath('/business/offersx')).toBeNull();
    expect(businessNavIdForPath('/feed')).toBeNull();
    expect(isBusinessPath('/businessman')).toBe(false);
    expect(isBusinessPath('/business/pay')).toBe(true);
  });
});

describe('businessNavItems', () => {
  it('shows every section to a signed-in viewer', () => {
    expect(businessNavItems(true)).toEqual(BUSINESS_NAV_ITEMS);
  });

  it('shows only the public catalog to a guest', () => {
    expect(businessNavItems(false).map((item) => item.id)).toEqual([
      'discover',
    ]);
  });
});
