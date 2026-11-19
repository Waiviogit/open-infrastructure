'use client';

import { useId, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ModalShell, ModalShellCloseButton } from '@/shared/presentation';

import { BusinessButton } from './business-button';
import type { BusinessButtonVariant } from './classes';
import { BusinessActionError } from './business-states';

export type BusinessFormModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Broadcast in flight: blocks Escape, backdrop, Cancel and the close button. */
  busy: boolean;
  /** Last broadcast / action failure; shown above the footer, the form stays filled. */
  error?: string | null;
  submitLabel: string;
  canSubmit: boolean;
  /**
   * Resolves `true` when the action succeeded. The modal closes only then, so a failed or
   * cancelled wallet broadcast keeps the user's input.
   */
  onSubmit: () => Promise<boolean>;
  submitVariant?: BusinessButtonVariant;
  /** Extra footer buttons, rendered before Cancel (e.g. a destructive alternative). */
  footerStart?: ReactNode;
  maxWidthClass?: string;
  children: ReactNode;
};

export function BusinessFormModal({
  open,
  onClose,
  title,
  busy,
  error,
  submitLabel,
  canSubmit,
  onSubmit,
  submitVariant = 'primary',
  footerStart,
  maxWidthClass = 'max-w-md',
  children,
}: BusinessFormModalProps) {
  const { t } = useI18n();
  const titleId = useId();

  async function handleSubmit() {
    if (await onSubmit()) {
      onClose();
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      labelledBy={titleId}
      maxWidthClass={maxWidthClass}
      header={
        <div className="flex items-center justify-between gap-3 border-b border-border px-card-padding py-3">
          <h2
            id={titleId}
            className="min-w-0 text-body font-weight-strong text-heading"
          >
            {title}
          </h2>
          <ModalShellCloseButton
            onClose={onClose}
            disabled={busy}
            ariaLabel={t('business_modal_close')}
          />
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 border-t border-border px-card-padding py-3">
          <BusinessActionError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            {footerStart}
            <BusinessButton onClick={onClose} disabled={busy}>
              {t('business_modal_cancel')}
            </BusinessButton>
            <BusinessButton
              variant={submitVariant}
              busy={busy}
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {submitLabel}
            </BusinessButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-card-padding">{children}</div>
    </ModalShell>
  );
}
