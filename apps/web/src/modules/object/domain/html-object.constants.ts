/** Object type whose body is a standalone HTML page (`htmlContent` update). */
export const HTML_OBJECT_TYPE = 'html';

/**
 * Leading primary tab for `html` objects. Lives at the clean `/object/:id` URL (like Details):
 * not in `OBJECT_PAGE_PATH_TAB_SEGMENTS`, so there is no `/object/:id/html` path.
 */
export const HTML_PRIMARY_TAB_SEGMENT = 'html';

/** The HTML tab shows the page wide: no right rail, the center spans its column. */
export function objectPageHidesRightRail(
  objectTypeKey: string,
  activePrimarySegment: string,
): boolean {
  return objectTypeKey === HTML_OBJECT_TYPE && activePrimarySegment === HTML_PRIMARY_TAB_SEGMENT;
}

/** Legacy Waivio path segment (`/object/:id/code`); the proxy redirects it (308) to the clean URL. */
export const HTML_LEGACY_CODE_PATH_SEGMENT = 'code';

/**
 * iframe sandbox for on-chain HTML. Never `allow-same-origin`: the page runs in an opaque origin,
 * so its scripts cannot read the app's cookies, storage or DOM. Popups escape the sandbox so
 * links opened in a new tab behave like normal pages.
 */
export const HTML_SANDBOX_PERMISSIONS =
  'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation' as const;

/** `postMessage` tag the sandbox bootstrap uses when it reports its document height. */
export const HTML_SANDBOX_MESSAGE_SOURCE = 'odl-html-sandbox';

/** Starting height of an auto-sized sandbox before the page reports its own height. */
export const HTML_SANDBOX_MIN_HEIGHT_PX = 320;

/** Show the frame after this long even if the page is still loading (slow images, fonts). */
export const HTML_SANDBOX_REVEAL_TIMEOUT_MS = 1500;

/** Upper bound for a reported height, so a runaway page cannot grow the frame forever. */
export const HTML_SANDBOX_MAX_HEIGHT_PX = 50_000;

/** Language tag of the editor code block that holds the HTML source. */
export const HTML_EDITOR_CODE_LANGUAGE = 'html';
