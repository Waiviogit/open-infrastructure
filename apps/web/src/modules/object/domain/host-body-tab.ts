import { UPDATE_TYPES } from '@opden-data-layer/core/update-types';

import type { MessageKey } from '@/i18n/types';

import { HTML_OBJECT_TYPE, HTML_PRIMARY_TAB_SEGMENT } from './html-object.constants';
import type { ObjectPageViewModel } from './object-page.types';

/**
 * How a host body is written and shown:
 * - `html` — a standalone web page, edited as one `html` code block, shown in a sandboxed iframe;
 * - `markdown` — rich text, edited as the editor's own markdown, shown with the post body renderer.
 */
export type HostBodyFormat = 'html' | 'markdown';

/**
 * Object types whose page *is* one body update. They open on a leading tab at the clean
 * `/object/:id` URL, shown wide (no right rail), editable in edit mode with preview before publish.
 */
export type HostBodyTabDefinition = {
  objectType: string;
  /** Primary tab segment (not a URL path: the tab lives at `/object/:id`). */
  segment: HostBodyTabSegment;
  label: string;
  /** The update a publish creates. */
  updateType: string;
  format: HostBodyFormat;
  /** i18n key of the empty view. */
  emptyMessageKey: MessageKey;
};

export const PAGE_PRIMARY_TAB_SEGMENT = 'page';
export const DOCUMENT_PRIMARY_TAB_SEGMENT = 'document';

export type HostBodyTabSegment =
  | typeof HTML_PRIMARY_TAB_SEGMENT
  | typeof PAGE_PRIMARY_TAB_SEGMENT
  | typeof DOCUMENT_PRIMARY_TAB_SEGMENT;

const HOST_BODY_TABS: readonly HostBodyTabDefinition[] = [
  {
    objectType: HTML_OBJECT_TYPE,
    segment: HTML_PRIMARY_TAB_SEGMENT,
    label: 'HTML',
    updateType: UPDATE_TYPES.HTML_CONTENT,
    format: 'html',
    emptyMessageKey: 'object_html_empty',
  },
  {
    objectType: 'page',
    segment: PAGE_PRIMARY_TAB_SEGMENT,
    label: 'Page',
    updateType: UPDATE_TYPES.PAGE_CONTENT,
    format: 'markdown',
    emptyMessageKey: 'object_page_empty',
  },
  {
    objectType: 'legal_document',
    segment: DOCUMENT_PRIMARY_TAB_SEGMENT,
    label: 'Document',
    updateType: UPDATE_TYPES.LEGAL_TEXT,
    format: 'markdown',
    emptyMessageKey: 'object_document_empty',
  },
];

export function hostBodyTabForObjectType(objectTypeKey: string): HostBodyTabDefinition | null {
  return HOST_BODY_TABS.find((tab) => tab.objectType === objectTypeKey) ?? null;
}

/** The host body tab when it is the active tab of this object, else null. */
export function activeHostBodyTab(
  objectTypeKey: string,
  activePrimarySegment: string,
): HostBodyTabDefinition | null {
  const tab = hostBodyTabForObjectType(objectTypeKey);
  return tab && tab.segment === activePrimarySegment ? tab : null;
}

/**
 * Legacy Waivio paths of host bodies (`/object/:id/code` for html, `/object/:id/page` for page);
 * the proxy redirects them (308) to the clean URL, where the tab now lives.
 */
export const LEGACY_HOST_BODY_PATH_SEGMENTS = ['code', 'page'] as const;

/** Host body tab segments: they navigate to the clean `/object/:id` URL. */
export function isHostBodyTabSegment(segment: string): boolean {
  return HOST_BODY_TABS.some((tab) => tab.segment === segment);
}

/** The body the host body tab shows and edits (`htmlContent` already normalized), or null. */
export function hostBodySourceFromModel(
  model: Pick<ObjectPageViewModel, 'objectTypeKey' | 'htmlContent' | 'pageContent' | 'legalText'>,
): string | null {
  const tab = hostBodyTabForObjectType(model.objectTypeKey);
  if (!tab) {
    return null;
  }
  if (tab.updateType === UPDATE_TYPES.HTML_CONTENT) {
    return model.htmlContent;
  }
  if (tab.updateType === UPDATE_TYPES.PAGE_CONTENT) {
    return model.pageContent;
  }
  return model.legalText;
}

/** A host body tab shows its body wide: no right rail, the center spans its column. */
export function objectPageHidesRightRail(
  objectTypeKey: string,
  activePrimarySegment: string,
): boolean {
  return activeHostBodyTab(objectTypeKey, activePrimarySegment) != null;
}
