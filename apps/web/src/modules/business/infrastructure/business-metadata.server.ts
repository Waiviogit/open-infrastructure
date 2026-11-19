import 'server-only';

import type { Metadata } from 'next';
import { cache } from 'react';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { buildOfferMetadata } from '@/seo';

import {
  contractDisplayLabel,
  detailsTitle,
  reportDisplayLabel,
  serviceOrderDisplayLabel,
} from '../domain/contract-label';
import {
  fetchOblContract,
  fetchOblDispute,
  fetchOblInvoice,
  fetchOblReport,
  fetchOblServiceOrder,
} from './clients/obl-ledger.server';
import { fetchOblDraftOne } from './clients/obl-drafts.server';
import { fetchOblOffer } from './clients/obl-offers.server';

type Messages = Readonly<Record<string, string>>;

/** Same title separator as the entity headings (`Logo design · v2`). */
const TITLE_SEPARATOR = ' · ';

/** One draft read per request for the editor / preview page and its metadata. */
export const loadOblDraftForPage = cache(fetchOblDraftOne);

async function requestMessages(): Promise<Messages> {
  return loadMessages(await getRequestLocale());
}

function message(messages: Messages, key: string, fallback: string): string {
  return messages[key]?.trim() || fallback;
}

/**
 * `<entity> · <kind>`: an invoice, dispute and report of the same contract share the contract
 * label, so the kind keeps their browser tabs apart.
 */
function entityTitle(label: string | null | undefined, kind: string): Metadata {
  const name = label?.trim();
  return { title: name ? `${name}${TITLE_SEPARATOR}${kind}` : kind };
}

export async function contractMetadata(contractId: string): Promise<Metadata> {
  const [messages, contract] = await Promise.all([
    requestMessages(),
    fetchOblContract(contractId),
  ]);
  return entityTitle(
    contract ? contractDisplayLabel(contract) : null,
    message(messages, 'business_field_contract', 'Contract'),
  );
}

export async function invoiceMetadata(invoiceId: string): Promise<Metadata> {
  const [messages, detail] = await Promise.all([
    requestMessages(),
    fetchOblInvoice(invoiceId),
  ]);
  const label = detail
    ? (detailsTitle(detail.invoice.details) ??
      (detail.contract ? contractDisplayLabel(detail.contract) : null))
    : null;
  return entityTitle(
    label,
    message(messages, 'business_field_invoice', 'Invoice'),
  );
}

export async function disputeMetadata(disputeId: string): Promise<Metadata> {
  const [messages, detail] = await Promise.all([
    requestMessages(),
    fetchOblDispute(disputeId),
  ]);
  return entityTitle(
    detail?.contract ? contractDisplayLabel(detail.contract) : null,
    message(messages, 'business_field_dispute', 'Dispute'),
  );
}

export async function serviceOrderMetadata(
  serviceOrderId: string,
): Promise<Metadata> {
  const [messages, detail] = await Promise.all([
    requestMessages(),
    fetchOblServiceOrder(serviceOrderId),
  ]);
  return entityTitle(
    detail
      ? serviceOrderDisplayLabel(
          detail.serviceOrder,
          detail.contract ? [detail.contract] : [],
        )
      : null,
    message(messages, 'business_field_service_order', 'Service order'),
  );
}

export async function reportMetadata(reportId: string): Promise<Metadata> {
  const [messages, detail] = await Promise.all([
    requestMessages(),
    fetchOblReport(reportId),
  ]);
  return entityTitle(
    detail
      ? reportDisplayLabel(
          detail.report,
          detail.contract ? [detail.contract] : [],
        )
      : null,
    message(messages, 'business_field_report', 'Report'),
  );
}

export async function relationshipMetadata(account: string): Promise<Metadata> {
  const messages = await requestMessages();
  return entityTitle(
    `@${account}`,
    message(messages, 'business_relationships_title', 'Relationships'),
  );
}

export async function draftMetadata(
  author: string,
  draftId: string,
): Promise<Metadata> {
  const [messages, draft] = await Promise.all([
    requestMessages(),
    loadOblDraftForPage(author, draftId),
  ]);
  const name = draft?.fields.name;
  return entityTitle(
    typeof name === 'string' && name.trim()
      ? name
      : message(messages, 'business_draft_untitled', 'Untitled draft'),
    message(messages, 'business_editor_draft_label', 'Draft'),
  );
}

/** Owner view of a published offer or one of its versions (`/business/manage/offers/...`). */
export async function ownerOfferMetadata(
  offerId: string,
  version?: number,
): Promise<Metadata> {
  const [messages, offer] = await Promise.all([
    requestMessages(),
    fetchOblOffer(offerId, version),
  ]);
  if (!offer) {
    return entityTitle(
      null,
      message(messages, 'business_kind_label_offer', 'Offer'),
    );
  }
  const kind = message(
    messages,
    `business_kind_label_${offer.kind}`,
    offer.kind === 'request' ? 'Request' : 'Offer',
  );
  return entityTitle(`${offer.name}${TITLE_SEPARATOR}v${offer.version}`, kind);
}

export async function payOnBehalfMetadata(): Promise<Metadata> {
  const messages = await requestMessages();
  return {
    title: message(messages, 'business_pay_on_behalf_title', 'Pay on behalf'),
  };
}

/** Public, indexable offer / request version page. */
export async function publicOfferMetadata(
  offerId: string,
  version: number,
): Promise<Metadata> {
  const [messages, offer] = await Promise.all([
    requestMessages(),
    fetchOblOffer(offerId, version),
  ]);
  if (!offer) {
    return { title: message(messages, 'business_kind_label_offer', 'Offer') };
  }
  return buildOfferMetadata({
    kind: offer.kind,
    offerId: offer.offer_id,
    version: offer.version,
    name: offer.name,
    description: offer.description,
    authorName: offer.author,
    kindLabel: message(
      messages,
      `business_kind_label_${offer.kind}`,
      offer.kind === 'request' ? 'Request' : 'Offer',
    ),
  });
}
