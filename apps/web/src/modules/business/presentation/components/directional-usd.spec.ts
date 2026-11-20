import { shouldShowPendingWhenSettled } from './directional-usd';

describe('shouldShowPendingWhenSettled', () => {
  const confirmedSettled = {
    owesAtoB: '0.00000000',
    owesBtoA: '0.00000000',
    netUsd: '0.00000000',
  };
  const pendingOwes = {
    owesAtoB: '10.00000000',
    owesBtoA: '0.00000000',
    netUsd: '-10.00000000',
  };

  it('is true when confirmed is settled and pending is non-zero', () => {
    expect(
      shouldShowPendingWhenSettled(
        'flowmaster',
        'flowmaster',
        'shadow.hunter',
        confirmedSettled,
        pendingOwes,
      ),
    ).toBe(true);
  });

  it('is false when pending is also zero', () => {
    expect(
      shouldShowPendingWhenSettled(
        'flowmaster',
        'flowmaster',
        'shadow.hunter',
        confirmedSettled,
        confirmedSettled,
      ),
    ).toBe(false);
  });
});
