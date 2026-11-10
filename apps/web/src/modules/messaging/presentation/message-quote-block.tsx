'use client';

import { useMemo } from 'react';

import Image from 'next/image';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { getImagePathPost, shouldUnoptimizeRemoteImage } from '@/shared/presentation';

import type { MessageQuotePreview } from '../domain/messaging.helpers';

/** Quoted parent above a reply (author, text excerpt, first image) — feed rows and the activity preview. */
export function MessageQuoteBlock({ quote }: { quote: MessageQuotePreview }) {
  const { t } = useI18n();
  const imageDisplayUrl = useMemo(
    () => (quote.imageUrl ? getImagePathPost(quote.imageUrl) : null),
    [quote.imageUrl],
  );

  return (
    <div
      className={[
        'mb-2 border-s-2 ps-2 text-caption',
        quote.deleted ? 'border-border text-muted' : 'border-accent text-muted',
      ].join(' ')}
    >
      {quote.deleted ? (
        <span>{t('messaging_reply_deleted')}</span>
      ) : imageDisplayUrl ? (
        <div className="flex items-start gap-2">
          <Image
            src={imageDisplayUrl}
            alt=""
            width={160}
            height={120}
            className="h-12 w-auto shrink-0"
            unoptimized={shouldUnoptimizeRemoteImage(imageDisplayUrl)}
          />
          <div className="min-w-0 flex-1">
            <span className="font-weight-label text-fg-secondary">{quote.author}</span>
            {quote.body.trim().length > 0 ? (
              <p className="line-clamp-2 break-words">{quote.body}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <span className="font-weight-label text-fg-secondary">{quote.author}</span>
          <p className="line-clamp-2 break-words">{quote.body}</p>
        </>
      )}
    </div>
  );
}
