'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { ChevronDownIcon, SearchIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { formatObjectTypeLabel } from '@/modules/app-header/domain/search-nav-list';
import {
  MODAL_Z_INDEX_DEFAULT,
  profileSectionTabClass,
} from '@/shared/presentation';

import { buildDiscoverHref } from '../../domain/discover-url';
import {
  listDiscoverMoreObjectTypes,
  matchesDiscoverTypeSearch,
} from '../../domain/discover-registry';
import { iconForDiscoverObjectType } from '../../domain/discover-type-icons';
import { DiscoverTypeTabLink } from './discover-type-tab-link';

const MENU_GAP_PX = 4;
const MENU_WIDTH_PX = 256;
const VIEWPORT_MARGIN_PX = 16;

type MenuPosition = { top: number; left: number; width: number };

/** Below the trigger, right edges aligned, kept inside the viewport on narrow screens. */
function measureMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(
    MENU_WIDTH_PX,
    window.innerWidth - 2 * VIEWPORT_MARGIN_PX,
  );
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX;
  const left = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(rect.right - width, maxLeft),
  );
  return { top: rect.bottom + MENU_GAP_PX, left, width };
}

const MENU_ROW_BASE_CLASS =
  'flex w-full items-center px-3 py-2 text-start text-body-sm transition-colors';

function moreRowClass(active: boolean): string {
  return [
    MENU_ROW_BASE_CLASS,
    active
      ? 'bg-accent-soft font-weight-label text-accent'
      : 'text-fg hover:bg-ghost-surface',
  ].join(' ');
}

export type DiscoverMoreTypesMenuProps = {
  /** Active registry type; highlighted in the list when it is a More type. */
  activeType: string | null;
  q: string;
  sort: 'newest' | 'oldest' | 'rank';
};

/**
 * `More` tab of the discover type menu: a popover with a type search and every type that is not a
 * popular tab. Portaled with fixed positioning so the scrollable tab row does not clip it; pointer
 * events stop at the popover so they do not drag the row.
 */
export function DiscoverMoreTypesMenu({
  activeType,
  q,
  sort,
}: DiscoverMoreTypesMenuProps) {
  const { t } = useI18n();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const types = useMemo(() => listDiscoverMoreObjectTypes(), []);
  const filteredTypes = useMemo(
    () => types.filter((type) => matchesDiscoverTypeSearch(type, query)),
    [types, query],
  );
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      setPosition(measureMenuPosition(triggerRef.current));
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(() =>
      searchRef.current?.focus(),
    );
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // Re-measure instead of closing: the mobile keyboard resizes the viewport while searching.
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, close, updatePosition]);

  const onMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (
      !next ||
      menuRef.current?.contains(next) ||
      triggerRef.current?.contains(next)
    ) {
      return;
    }
    close();
  };

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="overflow-hidden rounded-card border border-border bg-surface shadow-card-float"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: MODAL_Z_INDEX_DEFAULT,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onBlur={onMenuBlur}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <SearchIcon size={16} className="shrink-0 text-fg-secondary" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('discover_search_object_types')}
                aria-label={t('discover_search_object_types')}
                autoComplete="off"
                className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-fg outline-none placeholder:text-fg-tertiary"
              />
            </div>
            <nav aria-label={t('discover_more_types_aria')}>
              {filteredTypes.length === 0 ? (
                <p className="px-3 py-2 text-body-sm text-fg-secondary">
                  {t('discover_no_results')}
                </p>
              ) : (
                <ul className="max-h-[min(24rem,60dvh)] overflow-y-auto py-1">
                  {filteredTypes.map((type) => (
                    <li key={type}>
                      <DiscoverTypeTabLink
                        href={buildDiscoverHref({ type, q, sort })}
                        icon={iconForDiscoverObjectType(type)}
                        label={formatObjectTypeLabel(type)}
                        active={type === activeType}
                        className={moreRowClass(type === activeType)}
                        rememberType={type}
                        onNavigate={close}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </nav>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={profileSectionTabClass(open, 'primary')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {t('discover_more_types')}
          <ChevronDownIcon size={14} className="shrink-0" />
        </span>
      </button>
      {menu}
    </>
  );
}
