import type { OblDisputeRule } from '@opden-data-layer/odl-db-types';

import type {
  LedgerContractRow,
  LedgerDisputeRow,
  LedgerInvoiceRow,
} from './ledger.types';

export type DisputeAuthority = {
  rule: OblDisputeRule;
  resolverAccount: string;
  provider: string;
  client: string;
  arbiter: string | null;
};

export function disputeAuthorityForInvoice(
  invoice: LedgerInvoiceRow,
  contracts: readonly LedgerContractRow[],
  governingContract?: LedgerContractRow | null,
): DisputeAuthority {
  const contract =
    governingContract ??
    (invoice.contract_id
      ? contracts.find((c) => c.contract_id === invoice.contract_id)
      : undefined);

  const rule = contract?.dispute_rule ?? 'client';
  const provider = contract?.provider ?? invoice.creditor;
  const client = contract?.client ?? invoice.debtor;
  const arbiter = contract?.arbiter ?? null;

  let resolverAccount = client;
  if (rule === 'provider') {
    resolverAccount = provider;
  } else if (rule === 'arbiter' && arbiter) {
    resolverAccount = arbiter;
  }

  return { rule, resolverAccount, provider, client, arbiter };
}

export type CanViewerResolveDisputeOptions = {
  invoice?: LedgerInvoiceRow | null;
  governingContract?: LedgerContractRow | null;
};

export function canViewerResolveDispute(
  viewer: string,
  dispute: LedgerDisputeRow,
  invoices: readonly LedgerInvoiceRow[],
  contracts: readonly LedgerContractRow[],
  options?: CanViewerResolveDisputeOptions,
): boolean {
  if (dispute.status !== 'open') {
    return false;
  }
  const invoice =
    options?.invoice ??
    invoices.find((inv) => inv.invoice_id === dispute.invoice_id);
  if (!invoice) {
    return false;
  }
  const authority = disputeAuthorityForInvoice(
    invoice,
    contracts,
    options?.governingContract,
  );
  if (authority.rule === 'arbiter' && !authority.arbiter) {
    return false;
  }
  return viewer === authority.resolverAccount;
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

export function findInvoiceForDispute(
  dispute: LedgerDisputeRow,
  invoices: readonly LedgerInvoiceRow[],
): LedgerInvoiceRow | undefined {
  return invoices.find((inv) => inv.invoice_id === dispute.invoice_id);
}
