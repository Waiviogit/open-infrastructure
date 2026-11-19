'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CheckIcon, CopyIcon } from '@/icons';

import { shortenId } from '../../domain/contract-label';
import { BUSINESS_FOCUS_RING } from './classes';

const COPIED_RESET_MS = 2000;

/**
 * Secondary technical id (contract, invoice, transaction): shortened in the middle, full value
 * in the tooltip and on copy. Never use an id as the primary label of an entity.
 */
export function CopyableId({
  id,
  className = '',
}: {
  id: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1 ${className}`}
    >
      <span
        className="truncate font-mono text-caption text-fg-secondary"
        title={id}
      >
        {shortenId(id)}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? t('business_copied') : t('business_copy_id')}
        title={copied ? t('business_copied') : t('business_copy_id')}
        className={`inline-flex size-7 shrink-0 items-center justify-center rounded-btn text-fg-secondary transition-colors hover:bg-surface-control hover:text-fg ${BUSINESS_FOCUS_RING}`}
      >
        {copied ? (
          <CheckIcon size={14} className="text-success" />
        ) : (
          <CopyIcon size={14} />
        )}
      </button>
    </span>
  );
}
