import { resolveActiveSubTab, type BusinessSubTab } from './business-sub-tabs';

jest.mock('@/shared/presentation', () => ({
  parseNavHref: (href: string) => {
    const q = href.indexOf('?');
    return q === -1
      ? { pathname: href, search: '' }
      : { pathname: href.slice(0, q), search: href.slice(q + 1) };
  },
}));

const statusTabs: BusinessSubTab[] = [
  { id: 'open', href: '/business/arbitration', label: 'Open' },
  {
    id: 'resolved',
    href: '/business/arbitration?status=resolved',
    label: 'Resolved',
  },
];

describe('resolveActiveSubTab', () => {
  it('matches the exact query first', () => {
    expect(
      resolveActiveSubTab(
        statusTabs,
        { pathname: '/business/arbitration', search: 'status=resolved' },
        'open',
      ),
    ).toBe('resolved');
  });

  it('falls back to the default (query-less) tab on the same path', () => {
    expect(
      resolveActiveSubTab(
        statusTabs,
        { pathname: '/business/arbitration', search: 'cursor=x' },
        'resolved',
      ),
    ).toBe('open');
  });

  it('keeps the server tab while the target is another route', () => {
    expect(
      resolveActiveSubTab(
        statusTabs,
        { pathname: '/business/offers', search: '' },
        'resolved',
      ),
    ).toBe('resolved');
  });

  it('matches route tabs by pathname', () => {
    const routeTabs: BusinessSubTab[] = [
      { id: 'drafts', href: '/business/manage/offers/drafts', label: 'Drafts' },
      {
        id: 'published',
        href: '/business/manage/offers/published',
        label: 'Published',
      },
    ];
    expect(
      resolveActiveSubTab(
        routeTabs,
        { pathname: '/business/manage/offers/published', search: '' },
        'drafts',
      ),
    ).toBe('published');
  });
});
