/**
 * Human labels for OBL entities. Raw ids (`contract-{offerId}-{a}-{b}`, `inv-{uuid}`, …) are
 * secondary information: show them shortened, never as the only label.
 */

const ID_HEAD = 10;
const ID_TAIL = 6;
const ELLIPSIS = '…';

/** Middle-truncates an id so both the prefix (kind) and the unique tail stay readable. */
export function shortenId(id: string): string {
  if (id.length <= ID_HEAD + ID_TAIL + ELLIPSIS.length) {
    return id;
  }
  return `${id.slice(0, ID_HEAD)}${ELLIPSIS}${id.slice(-ID_TAIL)}`;
}

export type ContractLabelSource = {
  contract_id: string;
  offer_name?: string | null;
  offer_version?: number | null;
};

/**
 * `Logo design · v3`. One contract exists per offer and account pair, so the offer name and
 * version identify a contract inside a relationship; the shortened id is the fallback.
 */
export function contractDisplayLabel(contract: ContractLabelSource): string {
  const name = contract.offer_name?.trim();
  if (!name) {
    return shortenId(contract.contract_id);
  }
  return contract.offer_version != null
    ? `${name} · v${contract.offer_version}`
    : name;
}

const DETAIL_TITLE_KEYS = ['title', 'name', 'summary'] as const;

/** First short human-readable string in free-form `details` (service orders, reports). */
export function detailsTitle(
  details: Record<string, unknown> | null | undefined,
): string | null {
  if (!details) {
    return null;
  }
  for (const key of DETAIL_TITLE_KEYS) {
    const value = details[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export type ServiceOrderLabelSource = {
  service_order_id: string;
  contract_id: string;
  details: Record<string, unknown>;
};

/** `Homepage redesign · Logo design · v3`, falling back to the contract label and a short id. */
export function serviceOrderDisplayLabel(
  serviceOrder: ServiceOrderLabelSource,
  contracts: readonly ContractLabelSource[],
): string {
  const contract = contracts.find(
    (c) => c.contract_id === serviceOrder.contract_id,
  );
  const parts = [
    detailsTitle(serviceOrder.details),
    contract ? contractDisplayLabel(contract) : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0
    ? parts.join(' · ')
    : shortenId(serviceOrder.service_order_id);
}

export type ReportLabelSource = {
  report_id: string;
  contract_id: string | null;
  details: Record<string, unknown>;
};

/** `Delivered wireframes · Logo design · v3`, falling back to the contract label and a short id. */
export function reportDisplayLabel(
  report: ReportLabelSource,
  contracts: readonly ContractLabelSource[],
): string {
  const contract = contracts.find((c) => c.contract_id === report.contract_id);
  const parts = [
    detailsTitle(report.details),
    contract ? contractDisplayLabel(contract) : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : shortenId(report.report_id);
}

const PAYMENT_METHOD_KEYS: Readonly<Record<string, string>> = {
  offchain: 'business_payment_method_offchain',
  token_transfer: 'business_payment_method_token_transfer',
  upvote_reward: 'business_payment_method_upvote_reward',
};

/** i18n key for a ledger payment method, or null for an unknown method (show it as is). */
export function paymentMethodLabelKey(method: string): string | null {
  return PAYMENT_METHOD_KEYS[method] ?? null;
}

const DISPUTE_RULE_KEYS = {
  arbiter: 'business_dispute_arbiter',
  provider: 'business_dispute_provider',
  client: 'business_dispute_client',
} as const;

export function disputeRuleLabelKey(
  rule: keyof typeof DISPUTE_RULE_KEYS,
): string {
  return DISPUTE_RULE_KEYS[rule];
}
