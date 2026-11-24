import { passesCategoryDisplayRules } from './category-display-rules';

describe('passesCategoryDisplayRules', () => {
  it.each([
    [2, 10, false],
    [3, 10, true],
    [6, 10, true],
    [7, 10, false],
    [3, 3, false],
    [0, 0, false],
    [5, 0, false],
  ])('count %i of total %i → %s', (count, total, expected) => {
    expect(passesCategoryDisplayRules(count, total)).toBe(expected);
  });
});
