'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type BaseSelection,
  type TextNode,
} from 'lexical';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { formatObjectTypeLabel } from '@/modules/app-header/domain/search-nav-list';
import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import { fetchObjectSearchResults } from '@/modules/app-header/infrastructure/search.client';
import { MODAL_Z_INDEX_EDITOR_OVERLAY } from '@/shared/presentation';

import {
  buildHashSearchEntries,
  HASH_OBJECT_SEARCH_DEBOUNCE_MS,
  HASH_OBJECT_SEARCH_MIN_LENGTH,
  HASH_PLACE_SEARCH_DEBOUNCE_MS,
  HASH_PLACE_SEARCH_MIN_LENGTH,
  linkedPlaceToSearchObject,
  matchHashObjectQuery,
  type HashSearchEntry,
} from '../../application/hash-object-search';
import { $createObjectLinkNode } from '../../application/insert-editor-object-link';
import type { PlaceSearchItem } from '../../domain/place.schema';
import { fetchPlacesSearch } from '../../infrastructure/places.client';
import { EditorPlaceCreateModal } from './editor-place-create-modal';

const MENU_MAX_HEIGHT_PX = 320;
/** Under this much room below the caret, the menu opens above it when there is more room there. */
const MENU_MIN_ROOM_BELOW_PX = 160;
const MENU_VIEWPORT_MARGIN_PX = 8;
const MENU_CARET_GAP_PX = 4;

/** Caret rect in the viewport; the typeahead anchor when the selection has no measurable rect. */
function caretViewportRect(fallback: HTMLElement): DOMRect {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.height > 0) {
      return rect;
    }
  }
  return fallback.getBoundingClientRect();
}

/**
 * Places the menu by viewport room, not by the editor's own height: a compose pill is far
 * shorter than the menu, and a bottom-docked bar (DMs) has no room below the caret.
 */
function placeMenuInViewport(menu: HTMLElement, caret: DOMRect): void {
  const viewportHeight = window.innerHeight;
  const roomBelow = viewportHeight - caret.bottom - MENU_CARET_GAP_PX - MENU_VIEWPORT_MARGIN_PX;
  const roomAbove = caret.top - MENU_CARET_GAP_PX - MENU_VIEWPORT_MARGIN_PX;
  const openBelow = roomBelow >= MENU_MIN_ROOM_BELOW_PX || roomBelow >= roomAbove;
  const maxLeft = window.innerWidth - menu.offsetWidth - MENU_VIEWPORT_MARGIN_PX;
  menu.style.left = `${Math.max(MENU_VIEWPORT_MARGIN_PX, Math.min(caret.left, maxLeft))}px`;
  menu.style.maxHeight = `${Math.max(0, Math.min(MENU_MAX_HEIGHT_PX, openBelow ? roomBelow : roomAbove))}px`;
  menu.style.top = openBelow ? `${caret.bottom + MENU_CARET_GAP_PX}px` : '';
  menu.style.bottom = openBelow ? '' : `${viewportHeight - caret.top + MENU_CARET_GAP_PX}px`;
  menu.style.visibility = 'visible';
}

function HashSearchMenuSurface({
  anchor,
  query,
  children,
}: {
  anchor: HTMLElement;
  /** Re-place while typing: the caret moves with the query. */
  query: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const menu = menuRef.current;
      if (menu) {
        placeMenuInViewport(menu, caretViewportRect(anchor));
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, query]);

  return (
    <div
      ref={menuRef}
      className="fixed w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-btn border border-border bg-surface shadow-card-float"
      style={{ zIndex: MODAL_Z_INDEX_EDITOR_OVERLAY, visibility: 'hidden' }}
    >
      {children}
    </div>
  );
}

class HashSearchOption extends MenuOption {
  readonly entry: HashSearchEntry;

  constructor(entry: HashSearchEntry) {
    super(entry.key);
    this.entry = entry;
  }
}

function useDebouncedSearch<T>(
  query: string | null,
  minLength: number,
  debounceMs: number,
  search: (q: string, signal: AbortSignal) => Promise<T[]>,
): { results: T[]; loading: boolean } {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query?.trim() ?? '';
    if (q.length < minLength) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      void search(q, controller.signal)
        .catch(() => [] as T[])
        .then((next) => {
          if (controller.signal.aborted) {
            return;
          }
          setResults(next);
          setLoading(false);
        });
    }, debounceMs);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, minLength, debounceMs, search]);

  return { results, loading };
}

async function searchObjects(q: string, signal: AbortSignal): Promise<SearchObjectResult[]> {
  return (await fetchObjectSearchResults(q, { signal })) ?? [];
}

async function searchPlaces(q: string, signal: AbortSignal): Promise<PlaceSearchItem[]> {
  return fetchPlacesSearch(q, { signal });
}

function entryTitle(entry: HashSearchEntry): string {
  if (entry.kind === 'object') {
    return entry.object.name?.trim() || entry.object.object_id;
  }
  return entry.place.name;
}

function entrySubtitle(entry: HashSearchEntry): string | null {
  if (entry.kind === 'object') {
    return entry.object.parent_name;
  }
  return entry.place.formatted_address;
}

function entryTypeLabel(entry: HashSearchEntry): string {
  if (entry.kind === 'object') {
    return formatObjectTypeLabel(entry.object.object_type);
  }
  return formatObjectTypeLabel(entry.place.suggested_object_type);
}

export type EditorHashObjectSearchPluginProps = {
  /** Signed-in author: creating an object from a Google place is signed by this account. */
  username: string;
  /** Second section with Google Maps places near the user; off → our objects only. */
  googlePlaces: boolean;
  onObjectLinkedFromEditor?: (result: SearchObjectResult) => void;
};

/**
 * `#` in the post editor: our object search first, then Google Maps places near
 * the user. Picking an object (or a place that already has one) replaces
 * `#query` with an object link; a new place opens the create confirmation.
 */
export function EditorHashObjectSearchPlugin({
  username,
  googlePlaces,
  onObjectLinkedFromEditor,
}: EditorHashObjectSearchPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { t } = useI18n();
  const [query, setQuery] = useState<string | null>(null);
  const [pendingPlace, setPendingPlace] = useState<PlaceSearchItem | null>(null);
  const savedSelectionRef = useRef<BaseSelection | null>(null);

  const objects = useDebouncedSearch(
    query,
    HASH_OBJECT_SEARCH_MIN_LENGTH,
    HASH_OBJECT_SEARCH_DEBOUNCE_MS,
    searchObjects,
  );
  const places = useDebouncedSearch(
    googlePlaces ? query : null,
    HASH_PLACE_SEARCH_MIN_LENGTH,
    HASH_PLACE_SEARCH_DEBOUNCE_MS,
    searchPlaces,
  );

  const options = useMemo(
    () =>
      buildHashSearchEntries(objects.results, places.results).map(
        (entry) => new HashSearchOption(entry),
      ),
    [objects.results, places.results],
  );

  const triggerFn = useCallback(
    (text: string): MenuTextMatch | null => matchHashObjectQuery(text),
    [],
  );

  const linkObject = useCallback(
    (result: SearchObjectResult, nodeToReplace: TextNode | null) => {
      editor.update(() => {
        const link = $createObjectLinkNode(result);
        const trailingSpace = $createTextNode(' ');
        if (nodeToReplace) {
          nodeToReplace.replace(link);
        } else {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([link]);
          }
        }
        link.insertAfter(trailingSpace);
        trailingSpace.select(1, 1);
      });
      onObjectLinkedFromEditor?.(result);
    },
    [editor, onObjectLinkedFromEditor],
  );

  const onSelectOption = useCallback(
    (option: HashSearchOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      const { entry } = option;
      closeMenu();
      if (entry.kind === 'object') {
        linkObject(entry.object, nodeToReplace);
        return;
      }
      if (entry.kind === 'linked-place') {
        linkObject(linkedPlaceToSearchObject(entry.objectId, entry.place), nodeToReplace);
        return;
      }
      editor.update(() => {
        nodeToReplace?.remove();
        const selection = $getSelection();
        savedSelectionRef.current = $isRangeSelection(selection) ? selection.clone() : null;
      });
      setPendingPlace(entry.place);
    },
    [editor, linkObject],
  );

  const handlePlaceResolved = useCallback(
    (result: SearchObjectResult) => {
      const saved = savedSelectionRef.current;
      savedSelectionRef.current = null;
      editor.focus();
      editor.update(() => {
        if (saved) {
          $setSelection(saved.clone());
        }
      });
      linkObject(result, null);
    },
    [editor, linkObject],
  );

  const trimmedQuery = query?.trim() ?? '';
  const searching = objects.loading || places.loading;
  const statusText =
    trimmedQuery.length < HASH_OBJECT_SEARCH_MIN_LENGTH
      ? t(googlePlaces ? 'editor_hash_search_hint' : 'objects_auto_complete_placeholder')
      : searching
        ? t('editor_hash_search_loading')
        : t('editor_hash_search_empty');

  return (
    <>
      <LexicalTypeaheadMenuPlugin<HashSearchOption>
        onQueryChange={setQuery}
        onSelectOption={onSelectOption}
        triggerFn={triggerFn}
        options={options}
        menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
          const anchor = anchorElementRef.current;
          if (!anchor) {
            return null;
          }
          return createPortal(
            <HashSearchMenuSurface anchor={anchor} query={query ?? ''}>
              {options.length === 0 ? (
                <p className="px-3 py-2 text-body-sm text-muted" role="status">
                  {statusText}
                </p>
              ) : (
                <ul role="listbox" aria-label={t('editor_hash_search_label')}>
                  {options.map((option, index) => {
                    const previous = options[index - 1]?.entry.kind;
                    const isPlace = option.entry.kind === 'place';
                    const startsSection =
                      index === 0 || (isPlace && previous !== 'place');
                    const subtitle = entrySubtitle(option.entry);
                    return (
                      <li key={option.key} role="presentation">
                        {startsSection ? (
                          <p className="border-t border-border px-3 pb-1 pt-2 text-caption font-label text-muted first:border-t-0">
                            {isPlace ? t('editor_hash_search_places') : t('editor_hash_search_objects')}
                          </p>
                        ) : null}
                        <div
                          ref={(el) => option.setRefElement(el)}
                          role="option"
                          aria-selected={selectedIndex === index}
                          tabIndex={-1}
                          className={[
                            'flex cursor-pointer items-center gap-2 px-3 py-2 text-start',
                            selectedIndex === index ? 'bg-ghost-surface' : '',
                          ].join(' ')}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectOptionAndCleanUp(option)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-weight-label text-fg">
                              {entryTitle(option.entry)}
                            </span>
                            {subtitle ? (
                              <span className="block truncate text-body-sm text-muted">{subtitle}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 rounded-btn bg-surface-control px-1.5 py-0.5 text-caption text-muted">
                            {entryTypeLabel(option.entry)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  {places.loading ? (
                    <li role="presentation" className="px-3 py-2 text-caption text-muted">
                      {t('editor_hash_search_loading')}
                    </li>
                  ) : null}
                </ul>
              )}
            </HashSearchMenuSurface>,
            anchor,
          );
        }}
      />
      <EditorPlaceCreateModal
        place={pendingPlace}
        username={username}
        onClose={() => setPendingPlace(null)}
        onResolved={handlePlaceResolved}
      />
    </>
  );
}
