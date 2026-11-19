'use client';

import { useId } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ModalShell } from '@/shared/presentation';

import { BusinessButton } from './business-button';
import { BusinessActionError } from './business-states';

export type BusinessConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Irreversible on-chain actions use the destructive style. */
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Confirmation step before an irreversible Market action (retire offer, cancel service order,
 * reject a dispute). Escape / backdrop / Cancel are disabled while the broadcast is in flight.
 */
export function BusinessConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onClose,
}: BusinessConfirmDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descriptionId}
      maxWidthClass="max-w-md"
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      scrollBody={false}
    >
      <div className="flex flex-col gap-3 p-card-padding">
        <h2 id={titleId} className="text-body font-weight-strong text-heading">
          {title}
        </h2>
        <p id={descriptionId} className="text-body-sm text-fg">
          {description}
        </p>
        <BusinessActionError message={error} />
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <BusinessButton disabled={busy} onClick={onClose}>
            {t('business_modal_cancel')}
          </BusinessButton>
          <BusinessButton
            variant={destructive ? 'destructive' : 'primary'}
            busy={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </BusinessButton>
        </div>
      </div>
    </ModalShell>
  );
}
