'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ActivityTimestamp } from '@/modules/user-activity/presentation/components/activity-timestamp';

import type { LedgerServiceOrderRow } from '../../../domain/ledger.types';
import { businessRoutes } from '../../../domain/routes';
import {
  canCancelServiceOrder,
  serviceOrderStatus,
} from '../../../domain/service-order-cancel';
import { BusinessButton } from '../../ui/business-button';
import {
  BUSINESS_BREAK_TEXT,
  BUSINESS_FOCUS_RING,
  businessCardClass,
} from '../../ui/classes';
import { CopyableId } from '../../ui/copyable-id';
import { StateBadge } from '../state-badge';

export function BusinessServiceOrderCard({
  so,
  username,
  title,
  linkedContract,
  linkedContractUrl,
  isBusy,
  onCancel,
}: {
  so: LedgerServiceOrderRow;
  username: string;
  /** Human label (`serviceOrderDisplayLabel`); the id is shown as secondary info. */
  title: string;
  linkedContract: string | null;
  linkedContractUrl: string | null;
  isBusy: boolean;
  onCancel: (serviceOrderId: string) => void;
}) {
  const { t } = useI18n();
  const cancelled = serviceOrderStatus(so) === 'cancelled';
  const showCancel = canCancelServiceOrder(so, username);

  return (
    <article className={businessCardClass()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-card-padding">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-body font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`}
            >
              <Link
                href={businessRoutes.serviceOrder(so.service_order_id)}
                className={`rounded-btn hover:underline ${BUSINESS_FOCUS_RING}`}
                suppressHydrationWarning
              >
                {title}
              </Link>
            </h3>
            <StateBadge variant={cancelled ? 'cancelled' : 'active'} />
          </div>
          <p className="mt-0.5 text-caption text-fg-secondary">
            {t('business_service_order_by').replace(
              '{account}',
              `@${so.creator}`,
            )}
            {' · '}
            <ActivityTimestamp timestamp={so.created_at} />
          </p>
          {linkedContract ? (
            <p
              className={`mt-1 text-caption text-fg-secondary ${BUSINESS_BREAK_TEXT}`}
            >
              {t('business_field_contract')}:{' '}
              {linkedContractUrl ? (
                <Link
                  href={linkedContractUrl}
                  className="text-link hover:underline"
                  suppressHydrationWarning
                >
                  {linkedContract}
                </Link>
              ) : (
                linkedContract
              )}
            </p>
          ) : null}
        </div>
        <CopyableId id={so.service_order_id} />
      </div>
      {showCancel ? (
        <BusinessButton
          variant="destructive"
          size="sm"
          className="mt-3"
          disabled={isBusy}
          onClick={() => onCancel(so.service_order_id)}
        >
          {t('business_cancel_service_order')}
        </BusinessButton>
      ) : null}
    </article>
  );
}
