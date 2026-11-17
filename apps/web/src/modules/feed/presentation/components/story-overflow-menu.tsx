'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import {
  BrandFacebookIcon,
  BrandXIcon,
  CloseIcon,
  EyeOffIcon,
  FlagIcon,
  MoreHorizontalIcon,
  MuteIcon,
  PencilIcon,
  PinIcon,
  StarIcon,
  UserMinusIcon,
} from '@/icons';
import { useLoginModal } from '@/modules/auth';
import { useI18n } from '@/i18n/providers/i18n-provider';

export type StoryOverflowMenuProps = {
  authorName: string;
  /** Root posts: "Edit post" opens `/editor`. `null` when the item is not a root post. */
  editHref: string | null;
  /** Comments and threads: "Edit" opens the inline editor in place. */
  onEditInline?: () => void;
  /** Logged-in viewer username, or null when logged out. */
  currentUsername: string | null;
  isOwnPost: boolean;
  /** Object Posts feed only: Pin / Unpin / Remove the post for the object. */
  objectReview?: StoryObjectReviewMenu;
  /**
   * `trigger` (default): the menu opens from the ⋯ button's end edge.
   * `row`: it opens from the start edge of the nearest positioned ancestor (the story footer), so it
   * stays inside a feed card that sits in an `overflow-x-clip` column.
   */
  menuAnchor?: 'trigger' | 'row';
};

export type StoryObjectReviewMenu = {
  viewerPinned: boolean;
  pending: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onRemove: () => void;
};

type MenuRowProps = {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onActivate: () => void;
};

function MenuRow({ icon, label, disabled, onActivate }: MenuRowProps) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        className={[
          'flex w-full items-center gap-3 px-3 py-2.5 text-left text-body-sm text-fg-secondary',
          'transition-colors hover:bg-surface-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
          disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : 'cursor-pointer',
        ].join(' ')}
        onClick={() => {
          if (!disabled) {
            onActivate();
          }
        }}
      >
        <span className="shrink-0 text-muted [&_svg]:text-muted">{icon}</span>
        <span className="min-w-0 flex-1">{label}</span>
      </button>
    </li>
  );
}

type MenuLinkRowProps = {
  icon: ReactNode;
  label: string;
  href: string;
  onNavigate: () => void;
};

function MenuLinkRow({ icon, label, href, onNavigate }: MenuLinkRowProps) {
  return (
    <li role="none">
      <Link
        href={href}
        role="menuitem"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-body-sm text-fg-secondary transition-colors hover:bg-surface-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
        onClick={onNavigate}
      >
        <span className="shrink-0 text-muted [&_svg]:text-muted">{icon}</span>
        <span className="min-w-0 flex-1">{label}</span>
      </Link>
    </li>
  );
}

export function StoryOverflowMenu({
  authorName,
  editHref,
  onEditInline,
  currentUsername,
  isOwnPost,
  objectReview,
  menuAnchor = 'trigger',
}: StoryOverflowMenuProps) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const loggedIn = currentUsername != null && currentUsername !== '';

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function requireLoginOr(fn: () => void) {
    if (!loggedIn) {
      openLogin();
      closeMenu();
      return;
    }
    fn();
  }

  const showOwnVariant = loggedIn && isOwnPost;

  const objectReviewRows = objectReview ? (
    <>
      <MenuRow
        icon={<PinIcon size={18} className="shrink-0" />}
        label={t(objectReview.viewerPinned ? 'object_post_menu_unpin' : 'object_post_menu_pin')}
        disabled={objectReview.pending}
        onActivate={() =>
          requireLoginOr(() => {
            closeMenu();
            if (objectReview.viewerPinned) {
              objectReview.onUnpin();
            } else {
              objectReview.onPin();
            }
          })
        }
      />
      <MenuRow
        icon={<CloseIcon size={18} className="shrink-0" />}
        label={t('object_post_menu_remove')}
        disabled={objectReview.pending}
        onActivate={() =>
          requireLoginOr(() => {
            closeMenu();
            objectReview.onRemove();
          })
        }
      />
    </>
  ) : null;

  return (
    <div ref={rootRef} className={menuAnchor === 'trigger' ? 'relative inline-flex' : 'inline-flex'}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center rounded-btn px-1 py-1 text-caption text-muted transition-colors hover:bg-surface-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontalIcon size={20} />
        <span className="sr-only">{t('feed_story_menu_more_aria')}</span>
      </button>

      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className={`absolute bottom-full ${menuAnchor === 'trigger' ? 'end-0' : 'start-0'} z-50 mb-1 min-w-[15rem] list-none rounded-card border border-border bg-surface p-1 shadow-card`}
        >
          {objectReviewRows}
          {showOwnVariant ? (
            <>
              {editHref ? (
                <MenuLinkRow
                  icon={<PencilIcon size={18} className="shrink-0" />}
                  label={t('feed_story_menu_edit')}
                  href={editHref}
                  onNavigate={closeMenu}
                />
              ) : onEditInline ? (
                <MenuRow
                  icon={<PencilIcon size={18} className="shrink-0" />}
                  label={t('edit')}
                  onActivate={() => {
                    closeMenu();
                    onEditInline();
                  }}
                />
              ) : null}
              <MenuRow
                icon={<PinIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_pin')}
                disabled
                onActivate={() => undefined}
              />
              <MenuRow
                icon={<StarIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_bookmark')}
                disabled
                onActivate={() => undefined}
              />
              <MenuRow
                icon={<BrandFacebookIcon size={18} className="shrink-0 text-link" />}
                label={t('feed_story_menu_share_facebook')}
                disabled
                onActivate={() => undefined}
              />
              <MenuRow
                icon={<BrandXIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_share_x')}
                disabled
                onActivate={() => undefined}
              />
            </>
          ) : (
            <>
              <MenuRow
                icon={<UserMinusIcon size={18} className="shrink-0" />}
                label={`${t('feed_story_menu_unfollow')} @${authorName}`}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
              <MenuRow
                icon={<EyeOffIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_hide')}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
              <MenuRow
                icon={<MuteIcon size={18} className="shrink-0" />}
                label={`${t('feed_story_menu_mute')} @${authorName}`}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
              <MenuRow
                icon={<StarIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_bookmark')}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
              <MenuRow
                icon={<FlagIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_flag')}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
              <MenuRow
                icon={<BrandFacebookIcon size={18} className="shrink-0 text-link" />}
                label={t('feed_story_menu_share_facebook')}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
              <MenuRow
                icon={<BrandXIcon size={18} className="shrink-0" />}
                label={t('feed_story_menu_share_x')}
                disabled={loggedIn}
                onActivate={() =>
                  requireLoginOr(() => {
                    closeMenu();
                  })
                }
              />
            </>
          )}
        </ul>
      ) : null}
    </div>
  );
}
