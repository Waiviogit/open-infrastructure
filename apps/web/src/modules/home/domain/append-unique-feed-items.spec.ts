import { appendUniqueFeedItems } from './append-unique-feed-items';

const key = (item: { id: string }) => item.id;

describe('appendUniqueFeedItems', () => {
  it('appends new items in order', () => {
    expect(appendUniqueFeedItems([{ id: 'a' }], [{ id: 'b' }, { id: 'c' }], key)).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });

  it('skips items already listed and repeats inside the next page', () => {
    expect(
      appendUniqueFeedItems([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }], key),
    ).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });
});
