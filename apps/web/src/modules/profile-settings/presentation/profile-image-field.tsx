'use client';

import Image from 'next/image';
import { useId, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import {
  AppModal,
  AppModalCloseButton,
  IpfsImageDropZone,
  UserAvatar,
} from '@/shared/presentation';

const PREVIEW_SIZE_PX = 40;

export type ProfileImageFieldProps = {
  kind: 'avatar' | 'cover';
  username: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  error?: string | null;
};

const BUTTON_CLASS =
  'rounded-btn bg-accent px-4 py-1.5 text-body-sm font-weight-label text-accent-fg disabled:opacity-50';

function CoverPreview({ url }: { url: string }) {
  if (!url) {
    return <span aria-hidden className="block size-10 rounded-card bg-surface-control" />;
  }
  return (
    <Image
      src={url}
      alt=""
      width={PREVIEW_SIZE_PX}
      height={PREVIEW_SIZE_PX}
      unoptimized
      className="size-10 rounded-card object-cover"
    />
  );
}

/** Current picture + "Change" button; the modal uploads to IPFS and returns the content URL. */
export function ProfileImageField({
  kind,
  username,
  value,
  onChange,
  disabled = false,
  error,
}: ProfileImageFieldProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const isAvatar = kind === 'avatar';
  const label = t(isAvatar ? 'profile_picture' : 'profile_cover');
  const buttonLabel = t(isAvatar ? 'profile_change_avatar' : 'profile_change_cover');

  return (
    <div>
      <p className="mb-2 text-body font-weight-label text-fg">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        {isAvatar ? (
          <UserAvatar username={username} avatarUrl={value || null} size={PREVIEW_SIZE_PX} />
        ) : (
          <CoverPreview url={value} />
        )}
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {buttonLabel}
        </button>
        {value ? (
          <button
            type="button"
            className="text-body-sm text-fg-secondary hover:text-fg disabled:opacity-50"
            disabled={disabled}
            onClick={() => onChange('')}
          >
            {t('profile_image_remove')}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-caption text-error">
          {error}
        </p>
      ) : null}
      <AppModal open={open} onClose={() => setOpen(false)} labelledBy={titleId} panelClassName="p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-section font-weight-strong text-fg">
            {buttonLabel}
          </h2>
          <AppModalCloseButton onClose={() => setOpen(false)} ariaLabel={t('close')} />
        </div>
        <IpfsImageDropZone
          compact
          autoFocus
          listenDocumentPaste
          onUploaded={(result) => {
            onChange(result.previewUrl);
            setOpen(false);
          }}
        />
      </AppModal>
    </div>
  );
}
