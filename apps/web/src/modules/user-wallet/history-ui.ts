/**
 * Client-safe entry for wallet history swap/amount display, for other modules' client components.
 * The `index.ts` barrel also re-exports server queries (`'use cache'`), which must not reach a client bundle.
 */
export { WalletDualAmount } from './presentation/components/hive/history/wallet-history-row-shell';
export { formatWalletHistoryQuantity } from './domain/waiv-wallet-history-amount-format';
