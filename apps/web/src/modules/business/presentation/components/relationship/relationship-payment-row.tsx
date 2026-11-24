'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { splitMessage } from '@/i18n/domain/format-message';
import { useI18n } from '@/i18n/providers/i18n-provider';
import type { Translate } from '@/i18n/types';
import { ActivityTimestamp } from '@/modules/user-activity/presentation/components/activity-timestamp';

import {
  buildLedgerPaymentAmountView,
  buildLedgerPaymentDeclaredLabel,
  canConfirmLedgerPayment,
  hasPaymentDeclaredMismatch,
} from '../../../domain/ledger-payment-amount';
import type { LedgerPaymentRow } from '../../../domain/ledger.types';
import {
  extractPaymentRefNote,
  parsePaymentRefAuthorperm,
} from '../../../domain/payment-ref';
import { paymentMethodLabelKey } from '../../../domain/contract-label';
import { BusinessButton } from '../../ui/business-button';
import { BUSINESS_BREAK_TEXT, businessCardClass } from '../../ui/classes';
import { StateBadge } from '../state-badge';

export type RelationshipPaymentRowProps = {
  payment: LedgerPaymentRow;
  viewer: string;
  isBusy: boolean;
  onConfirm: (payment: LedgerPaymentRow) => void;
};

function ProfileLink({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <Link href={`/@${name}`} className="text-link" suppressHydrationWarning>
      {children}
    </Link>
  );
}

function PostLink({
  author,
  permlink,
  children,
}: {
  author: string;
  permlink: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/@${author}/${permlink}`}
      className="text-link"
      suppressHydrationWarning
    >
      {children}
    </Link>
  );
}

function paymentDescription(
  payment: LedgerPaymentRow,
  viewer: string,
  t: Translate,
): ReactNode {
  const postRef =
    payment.method === 'upvote_reward'
      ? parsePaymentRefAuthorperm(payment.ref)
      : null;
  if (postRef) {
    return (
      <>
        {t('business_payment_curation_reward')}{' '}
        <PostLink author={postRef.author} permlink={postRef.permlink}>
          @{postRef.author}/{postRef.permlink}
        </PostLink>
      </>
    );
  }

  const isOutgoing = payment.payer === viewer;
  const counterparty = isOutgoing ? payment.receiver : payment.payer;
  // One sentence per direction: word order differs by language, so the link goes where
  // `{account}` sits in the translation.
  const text = t(
    isOutgoing ? 'business_payment_sent_to' : 'business_payment_received_from',
  );
  const [before, after] = splitMessage(text, 'account') ?? [text, ''];

  return (
    <>
      {before}
      <ProfileLink name={counterparty}>@{counterparty}</ProfileLink>
      {after}
    </>
  );
}

export function RelationshipPaymentRow({
  payment,
  viewer,
  isBusy,
  onConfirm,
}: RelationshipPaymentRowProps) {
  const { t } = useI18n();
  const methodKey = paymentMethodLabelKey(payment.method);
  const methodLabel = methodKey ? t(methodKey) : payment.method;
  const amountView = buildLedgerPaymentAmountView(viewer, payment);
  const clickable = canConfirmLedgerPayment(payment, viewer);
  const refNote = extractPaymentRefNote(payment.ref);
  const showDeclaredMismatch = hasPaymentDeclaredMismatch(payment);

  return (
    <article className={businessCardClass()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-card-padding">
        <div className="min-w-0 flex-1">
          <p
            className={`text-body font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`}
          >
            {paymentDescription(payment, viewer, t)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-fg-secondary">
            <StateBadge
              variant={payment.state === 'pending' ? 'pending' : 'confirmed'}
            />
            <span>{methodLabel}</span>
            <span aria-hidden>·</span>
            <ActivityTimestamp timestamp={payment.created_at} />
          </div>
          {payment.paid_by ? (
            <p className="mt-1 text-caption text-fg-secondary">
              {t('business_payment_paid_by')}{' '}
              <ProfileLink name={payment.paid_by}>
                @{payment.paid_by}
              </ProfileLink>
            </p>
          ) : null}
          {refNote ? (
            <p
              className={`mt-1 text-caption text-fg-secondary ${BUSINESS_BREAK_TEXT}`}
            >
              {refNote}
            </p>
          ) : null}
          {clickable ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <BusinessButton
                variant="primary"
                size="sm"
                disabled={isBusy}
                onClick={() => onConfirm(payment)}
              >
                {t('business_confirm_received_payment')}
              </BusinessButton>
              <span className="text-caption text-fg">
                {t('business_payment_awaiting_confirm')}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5 sm:items-end">
          <p className="text-body font-weight-strong tabular-nums text-heading">
            {amountView.label}
          </p>
          {showDeclaredMismatch ? (
            <p className="text-caption tabular-nums text-fg-secondary">
              {t('business_field_declared_amount')}:{' '}
              {buildLedgerPaymentDeclaredLabel(payment)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
