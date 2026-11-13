import { alignToBucketHour, bucketRangeStart } from './feed-activity-window';

describe('feed activity window', () => {
  it('aligns a timestamp to the start of its hour', () => {
    expect(alignToBucketHour(7_200)).toBe(7_200);
    expect(alignToBucketHour(7_199)).toBe(3_600);
    expect(alignToBucketHour(10_799)).toBe(7_200);
  });

  it('covers the current hour plus the previous full hours', () => {
    const now = 100 * 3_600 + 1_234;
    expect(bucketRangeStart(now, 1)).toBe(100 * 3_600);
    expect(bucketRangeStart(now, 2)).toBe(99 * 3_600);
    expect(bucketRangeStart(now, 72)).toBe(29 * 3_600);
  });

  it('treats a non-positive span as the current hour only', () => {
    const now = 100 * 3_600 + 5;
    expect(bucketRangeStart(now, 0)).toBe(100 * 3_600);
  });
});
