import type { LedgerContractRow } from './ledger.types';

type ContractLike = Omit<
  LedgerContractRow,
  'offer_name' | 'offer_description' | 'service_order_schema'
> & {
  offer_name?: string | null;
  offer_description?: string | null;
  service_order_schema?: Record<string, unknown> | null;
};

/**
 * Normalises a contract from an inbox / detail API row into the ledger row shape used by the
 * dispute-authority and label helpers. `offerName` wins over the row's own (possibly missing) name.
 */
export function toLedgerContractRow(
  contract: ContractLike,
  offerName?: string | null,
): LedgerContractRow {
  return {
    contract_id: contract.contract_id,
    offer_id: contract.offer_id,
    offer_version: contract.offer_version,
    provider: contract.provider,
    client: contract.client,
    dispute_rule: contract.dispute_rule,
    arbiter: contract.arbiter,
    offer_name: offerName ?? contract.offer_name ?? '',
    offer_description: contract.offer_description ?? null,
    offer_status: contract.offer_status,
    service_order_schema: contract.service_order_schema ?? null,
    created_at: contract.created_at,
  };
}
