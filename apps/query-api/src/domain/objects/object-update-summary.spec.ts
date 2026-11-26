import { summarizeObjectUpdates } from './object-update-summary';

describe('summarizeObjectUpdates', () => {
  it('counts rows per update type and lists distinct locales in order', () => {
    const summary = summarizeObjectUpdates([
      { update_type: 'name', locale: 'ko-KR' },
      { update_type: 'name', locale: 'en-US' },
      { update_type: 'menuItem', locale: null },
      { update_type: 'name', locale: 'en-US' },
      { update_type: 'image', locale: '' },
    ]);

    expect(summary).toEqual({
      update_type_counts: { name: 3, menuItem: 1, image: 1 },
      update_locales: ['en-US', 'ko-KR'],
    });
  });

  it('returns empty structures for an object without updates', () => {
    expect(summarizeObjectUpdates([])).toEqual({ update_type_counts: {}, update_locales: [] });
  });
});
