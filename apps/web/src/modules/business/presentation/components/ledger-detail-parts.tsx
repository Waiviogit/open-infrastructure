'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronDownIcon } from '@/icons';
import { formatAbsoluteDateTime } from '@/shared/utils/format-relative-time';

import { ledgerDetailsEntries } from '../../domain/ledger-display';
import { businessRoutes } from '../../domain/routes';
import { BusinessAccountLink } from '../ui/business-account-link';
import { BusinessBreadcrumbs } from '../ui/business-breadcrumbs';
import {
  BusinessDetailSection,
  type BusinessDetailRow,
} from '../ui/business-detail-list';
import { BUSINESS_BREAK_TEXT, businessCardClass } from '../ui/classes';
import { CopyableId } from '../ui/copyable-id';

/** The other party of a provider / client pair, from the viewer's side (null for third parties). */
export function pairCounterparty(
  viewer: string,
  provider: string,
  client: string,
): string | null {
  if (viewer === provider) {
    return client;
  }
  if (viewer === client) {
    return provider;
  }
  return null;
}

/** Relationships › @counterparty › current entity (the pair link is omitted for third parties). */
export function LedgerBreadcrumbs({
  counterparty,
  current,
}: {
  counterparty: string | null;
  current: string;
}) {
  const { t } = useI18n();
  return (
    <BusinessBreadcrumbs
      items={[
        {
          label: t('business_nav_relationships'),
          href: businessRoutes.relationships,
        },
        ...(counterparty
          ? [
              {
                label: `@${counterparty}`,
                href: businessRoutes.relationship(counterparty),
              },
            ]
          : []),
        { label: current },
      ]}
    />
  );
}

/** Parties card: role label → avatar link to the relationship with that account. */
export function LedgerPartiesSection({
  viewer,
  parties,
}: {
  viewer: string;
  parties: ReadonlyArray<{ role: string; account: string | null | undefined }>;
}) {
  const { t } = useI18n();
  const rows: BusinessDetailRow[] = parties
    .filter((party): party is { role: string; account: string } =>
      Boolean(party.account),
    )
    .map((party) => ({
      label: party.role,
      value: (
        <BusinessAccountLink
          account={party.account}
          href={
            party.account === viewer
              ? undefined
              : businessRoutes.relationship(party.account)
          }
        />
      ),
    }));
  return (
    <BusinessDetailSection title={t('business_section_parties')} rows={rows} />
  );
}

/** Free-form `details` (service order, report, invoice) as label / value pairs, never raw JSON. */
export function LedgerDetailsSection({
  title,
  details,
}: {
  title: string;
  details: Record<string, unknown> | null | undefined;
}) {
  const entries = ledgerDetailsEntries(details);
  if (entries.length === 0) {
    return null;
  }
  return (
    <BusinessDetailSection
      title={title}
      rows={entries.map((entry) => ({
        label: entry.key,
        value: <span className="whitespace-pre-wrap">{entry.value}</span>,
        wide: entry.value.length > 60,
      }))}
    />
  );
}

/** Collapsed technical facts (ids, transaction, timestamps) for support and audits. */
export function LedgerTechnicalDetails({
  ids,
  createdAt,
  extra,
}: {
  ids: ReadonlyArray<{ label: string; id: string | null | undefined }>;
  createdAt?: string | null;
  extra?: ReactNode;
}) {
  const { t, locale } = useI18n();
  return (
    <details className={`${businessCardClass()} group`}>
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-body-sm font-weight-label text-fg [&::-webkit-details-marker]:hidden">
        {t('business_technical_details')}
        <ChevronDownIcon
          size={16}
          className="shrink-0 text-fg-secondary transition-transform group-open:rotate-180"
        />
      </summary>
      <dl className="mt-3 grid gap-x-card-padding gap-y-3 sm:grid-cols-2">
        {ids
          .filter((row): row is { label: string; id: string } =>
            Boolean(row.id),
          )
          .map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-caption text-fg-secondary">{row.label}</dt>
              <dd className="mt-0.5">
                <CopyableId id={row.id} />
              </dd>
            </div>
          ))}
        {createdAt ? (
          <div className="min-w-0">
            <dt className="text-caption text-fg-secondary">
              {t('business_field_created_at')}
            </dt>
            <dd
              className={`mt-0.5 text-body-sm text-fg ${BUSINESS_BREAK_TEXT}`}
            >
              <time dateTime={createdAt}>
                {formatAbsoluteDateTime(createdAt, locale)}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>
      {extra}
    </details>
  );
}
