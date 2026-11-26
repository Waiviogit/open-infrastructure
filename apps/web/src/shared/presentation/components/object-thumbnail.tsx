'use client';

import Image from 'next/image';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import {
  getImagePathPost,
  getPreviewProxyImageUrl,
  normalizeLegacyObjectImageUrl,
} from '../../infrastructure/image/get-proxy-image-url';
import { AVATAR_PLACEHOLDER_SRC } from '../avatar/resolve-avatar-url';
import { createImageFallbackMemory } from '../image/image-fallback-memory';
import { shouldUnoptimizeRemoteImage } from '../image/should-unoptimize-remote-image';

type LoadPhase = 'raw' | 'proxy' | 'preview' | 'placeholder';

const fallbackMemory = createImageFallbackMemory<LoadPhase>();

export type ObjectThumbnailProps = {
  src: string | null | undefined;
  alt?: string;
  /** Fixed box size in px (ignored when `fill` is true). */
  size?: number;
  className?: string;
  sizes?: string;
  fill?: boolean;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  /** Passed to normalization for steemitimages → Hive avatar mapping. */
  avatarSize?: 'small' | 'large';
};

export function ObjectThumbnail({
  src,
  alt = '',
  size = 40,
  className = '',
  sizes,
  fill = false,
  loading = 'lazy',
  priority = false,
  avatarSize = 'large',
}: ObjectThumbnailProps) {
  const normalizedRaw = useMemo(() => {
    const trimmed = src?.trim();
    return trimmed ? normalizeLegacyObjectImageUrl(trimmed, avatarSize) : '';
  }, [avatarSize, src]);

  const proxySrc = useMemo(
    () => (normalizedRaw ? getImagePathPost(normalizedRaw) : ''),
    [normalizedRaw],
  );

  const hasProxyFallback = Boolean(
    normalizedRaw && proxySrc && proxySrc !== normalizedRaw,
  );

  const [phase, setPhase] = useState<LoadPhase>(() =>
    normalizedRaw ? 'raw' : 'placeholder',
  );

  // Layout effect: a remount with a URL that already failed starts at its working fallback
  // before paint (the server render always starts at `raw`, so hydration matches).
  useLayoutEffect(() => {
    setPhase(normalizedRaw ? (fallbackMemory.get(normalizedRaw) ?? 'raw') : 'placeholder');
  }, [normalizedRaw, src]);

  const displaySrc = useMemo(() => {
    if (phase === 'placeholder') {
      return AVATAR_PLACEHOLDER_SRC;
    }
    if (phase === 'raw' && normalizedRaw) {
      return normalizedRaw;
    }
    if (phase === 'proxy' && proxySrc) {
      return proxySrc;
    }
    if (phase === 'preview' && normalizedRaw) {
      return getPreviewProxyImageUrl(normalizedRaw) || AVATAR_PLACEHOLDER_SRC;
    }
    return normalizedRaw || AVATAR_PLACEHOLDER_SRC;
  }, [normalizedRaw, phase, proxySrc]);

  const onError = useCallback(() => {
    let next: LoadPhase = 'placeholder';
    if (phase === 'raw') {
      next = hasProxyFallback ? 'proxy' : 'preview';
    } else if (phase === 'proxy') {
      next = 'preview';
    }
    if (normalizedRaw) {
      fallbackMemory.remember(normalizedRaw, next);
    }
    setPhase(next);
  }, [hasProxyFallback, normalizedRaw, phase]);

  const resolvedSizes = sizes ?? (fill ? `${size}px` : `${size}px`);
  const unoptimized =
    displaySrc === AVATAR_PLACEHOLDER_SRC
      ? true
      : shouldUnoptimizeRemoteImage(displaySrc);
  const resolvedLoading = priority ? 'eager' : loading;

  if (fill) {
    return (
      <Image
        src={displaySrc}
        alt={alt}
        fill
        className={className}
        sizes={resolvedSizes}
        loading={resolvedLoading}
        priority={priority}
        unoptimized={unoptimized}
        onError={onError}
      />
    );
  }

  return (
    <Image
      src={displaySrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      sizes={resolvedSizes}
      loading={resolvedLoading}
      priority={priority}
      unoptimized={unoptimized}
      onError={onError}
    />
  );
}
