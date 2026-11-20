function parseUsd(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Signed net USD of one balance bucket from `account`'s side: positive means the other
 * account owes `account`, negative means `account` owes the other one.
 *
 * Reads only `netUsd` (= owesBtoA − owesAtoB). The gross `owesAtoB` / `owesBtoA` are
 * per-direction totals that ignore invoices and credits issued the other way, so they
 * never answer "who owes whom" on their own.
 */
export function accountNetUsd(
  account: string,
  accountA: string,
  accountB: string,
  netUsd: string,
): number {
  const net = parseUsd(netUsd);
  return account === accountB ? -net : net;
}
