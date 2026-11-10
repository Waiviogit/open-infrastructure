/** Copies an app-relative permalink as an absolute URL. Returns `false` when the clipboard is unavailable. */
export async function copyPermalinkToClipboard(href: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
    return true;
  } catch {
    return false;
  }
}

/** Plain primary click — modified clicks keep browser behaviour (new tab / window). */
export function isPlainPrimaryClick(event: React.MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
