export const ACCOUNT_METADATA_UPDATED_EVENT = 'account.metadata.updated';

/** An indexed `account_update` / `account_update2` changed the account's metadata on chain. */
export class AccountMetadataUpdatedEvent {
  constructor(public readonly account: string) {}
}
