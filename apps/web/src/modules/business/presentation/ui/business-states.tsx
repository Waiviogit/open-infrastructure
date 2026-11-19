'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { InfoIcon } from '@/icons';

import { BusinessButton } from './business-button';
import { businessCardClass } from './classes';

export type BusinessEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/** Empty list / tab: one sentence and at most one next step. */
export function BusinessEmptyState({
  title,
  description,
  icon,
  action,
}: BusinessEmptyStateProps) {
  return (
    <div
      className={businessCardClass({
        className:
          'flex flex-col items-center gap-2 py-section-y-sm text-center',
      })}
    >
      {icon ? (
        <span className="mb-1 inline-flex size-10 items-center justify-center rounded-circle bg-surface-control text-fg-secondary">
          {icon}
        </span>
      ) : null}
      <h2 className="text-body font-weight-strong text-heading">{title}</h2>
      <p className="max-w-prose text-body-sm text-fg">{description}</p>
      {action ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

/** Load failure for a list or page section. Retry re-runs the server components. */
export function BusinessErrorState({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="alert"
      className={businessCardClass({
        className:
          'flex flex-col items-center gap-2 py-section-y-sm text-center',
      })}
    >
      <span className="mb-1 inline-flex size-10 items-center justify-center rounded-circle bg-surface-control text-error">
        <InfoIcon size={20} />
      </span>
      <h2 className="text-body font-weight-strong text-heading">
        {title ?? t('business_load_error_title')}
      </h2>
      <p className="max-w-prose text-body-sm text-fg">
        {description ?? t('business_load_error_body')}
      </p>
      <BusinessButton
        className="mt-2"
        busy={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {t('business_retry')}
      </BusinessButton>
    </div>
  );
}

/** Failed wallet broadcast / server action: translated headline plus the raw reason, if any. */
export function BusinessActionError({
  message,
}: {
  message: string | null | undefined;
}) {
  const { t } = useI18n();
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      className="rounded-card border border-error bg-surface px-3 py-2 text-body-sm"
    >
      <p className="font-weight-label text-error">
        {t('business_action_failed')}
      </p>
      <p className="mt-0.5 break-words text-caption text-fg [overflow-wrap:anywhere]">
        {message}
      </p>
    </div>
  );
}
