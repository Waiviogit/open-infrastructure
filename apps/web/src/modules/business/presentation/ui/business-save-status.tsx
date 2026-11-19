'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CheckIcon } from '@/icons';

import type { SaveState } from '../../application/use-offer-editor';
import { BUSINESS_FOCUS_RING } from './classes';

/** Autosave indicator: saving / saved / failed with a retry. Announced politely. */
export function BusinessSaveStatus({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex min-h-9 items-center gap-1.5 text-caption"
    >
      {state === 'saving' ? (
        <>
          <span
            className="inline-block size-3 animate-spin rounded-circle border-2 border-border border-t-accent"
            aria-hidden
          />
          <span className="text-fg-secondary">{t('business_saving')}</span>
        </>
      ) : null}
      {state === 'saved' ? (
        <>
          <CheckIcon size={14} className="text-success" />
          <span className="text-fg-secondary">{t('business_saved')}</span>
        </>
      ) : null}
      {state === 'error' ? (
        <>
          <span className="text-error">{t('business_save_failed')}</span>
          <button
            type="button"
            onClick={onRetry}
            className={`rounded-btn px-1 text-link underline-offset-2 hover:underline ${BUSINESS_FOCUS_RING}`}
          >
            {t('business_retry')}
          </button>
        </>
      ) : null}
    </span>
  );
}
