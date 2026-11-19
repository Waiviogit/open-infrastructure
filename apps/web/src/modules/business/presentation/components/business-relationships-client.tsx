'use client';

import Link from 'next/link';
import { useCallback, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronRightIcon, UsersIcon } from '@/icons';
import { ActivityTimestamp } from '@/modules/user-activity/presentation/components/activity-timestamp';
import {
  UserAvatar,
  useInfiniteScroll,
  useSyncedPaginatedList,
} from '@/shared/presentation';

import { businessRoutes } from '../../domain/routes';
import type { OblOffsetPage } from '../../domain/obl-pagination.types';
import { loadMoreOblRelationshipsAction } from '../../infrastructure/actions/load-more-obl.server';
import type { OblRelationshipApiRow } from '../../infrastructure/clients/obl-ledger.server';
import { BusinessPageShell } from '../layout/business-page-shell';
import {
  BUSINESS_BREAK_TEXT,
  businessButtonClass,
  businessCardClass,
} from '../ui/classes';
import { BusinessEmptyState, BusinessErrorState } from '../ui/business-states';
import { RelationshipRowBalance } from './relationship-row-balance';

const AVATAR_SIZE = 40;

export function BusinessRelationshipsClient({
  username,
  initialPage,
  loadFailed = false,
}: {
  username: string;
  initialPage: OblOffsetPage<OblRelationshipApiRow>;
  loadFailed?: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const { items, setItems, hasMore, setHasMore } =
    useSyncedPaginatedList(initialPage);

  const onLoadMore = useCallback(() => {
    if (!hasMore || pending) {
      return;
    }
    startTransition(async () => {
      const next = await loadMoreOblRelationshipsAction(username, items.length);
      setItems((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
    });
  }, [hasMore, items.length, pending, setHasMore, setItems, username]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: pending,
    onLoadMore,
  });

  function body() {
    if (loadFailed) {
      return <BusinessErrorState />;
    }
    if (items.length === 0) {
      return (
        <BusinessEmptyState
          icon={<UsersIcon size={20} />}
          title={t('business_relationships_empty_title')}
          description={t('business_relationships_empty_body')}
          action={
            <Link
              href={businessRoutes.discoverOffers}
              className={businessButtonClass({ variant: 'primary' })}
              suppressHydrationWarning
            >
              {t('business_view_offers')}
            </Link>
          }
        />
      );
    }
    return (
      <>
        <ul className="flex flex-col gap-card-padding">
          {items.map((row) => (
            <li key={row.counterparty}>
              <Link
                href={businessRoutes.relationship(row.counterparty)}
                className={businessCardClass({ interactive: true })}
                suppressHydrationWarning
              >
                <div className="flex items-center gap-3">
                  <UserAvatar username={row.counterparty} size={AVATAR_SIZE} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-body font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`}
                    >
                      @{row.counterparty}
                    </p>
                    <p className="text-caption text-fg-secondary">
                      {row.roles
                        .map((role) => t(`business_field_${role}`))
                        .join(' · ')}
                      {' · '}
                      {t('business_contracts_count').replace(
                        '{count}',
                        String(row.contractCount),
                      )}
                      {row.lastActivityAt ? (
                        <>
                          {' · '}
                          <ActivityTimestamp timestamp={row.lastActivityAt} />
                        </>
                      ) : null}
                    </p>
                    <RelationshipRowBalance
                      viewer={username}
                      counterparty={row.counterparty}
                      balance={row.balance}
                    />
                  </div>
                  <ChevronRightIcon
                    size={18}
                    className="shrink-0 text-fg-tertiary rtl:rotate-180"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div ref={sentinelRef} className="h-4" aria-hidden />
      </>
    );
  }

  return (
    <BusinessPageShell
      title={t('business_relationships_title')}
      subtitle={t('business_relationships_subtitle')}
    >
      {body()}
    </BusinessPageShell>
  );
}
