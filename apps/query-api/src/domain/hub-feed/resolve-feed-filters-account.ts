import type { AccountsCurrentRepository } from '../../repositories';

/** Stored account name for a rail request, or `null` when the account does not exist. */
export async function resolveFeedFiltersAccount(
  accounts: AccountsCurrentRepository,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }
  const account = await accounts.findByName(trimmed);
  return account ? account.name : null;
}
