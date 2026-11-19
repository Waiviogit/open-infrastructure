const SIGNATURE_SEPARATOR = '\n\n';

/**
 * Body of a new comment or thread with the author's profile signature at the end.
 * Empty body or signature leaves the body unchanged; a body that already ends with it is not signed twice.
 */
export function appendSignature(body: string, signature: string | null | undefined): string {
  const sign = signature?.trim() ?? '';
  if (!body.trim() || !sign) {
    return body;
  }
  const trimmedBody = body.trimEnd();
  if (trimmedBody.endsWith(sign)) {
    return body;
  }
  return `${trimmedBody}${SIGNATURE_SEPARATOR}${sign}`;
}
