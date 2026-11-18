import { extractHostBodyFromEditorMarkdown } from './host-body-editor';
import type { HostBodyFormat } from './host-body-tab';

/** One draft per signed-in user and object. */
export type HostBodyDraftKey = {
  username: string;
  objectId: string;
};

/** An unpublished edit of a host body (HTML, Page, Document). */
export type HostBodyDraft = HostBodyDraftKey & {
  /** Body update the draft was written for (`tab.updateType`); another type is not this draft. */
  updateType: string;
  /** Lexical JSON, as the editor emits it. */
  body: string;
  /** Hash of the published body the draft started from: a different hash means it is stale. */
  baseSourceHash: string;
  /** Epoch milliseconds of the last save. */
  updatedAt: number;
};

/**
 * Where drafts live. The browser adapter (IndexedDB) can be replaced by a backend one: the
 * contract is async and never rejects, so the editor works the same when storage is unavailable.
 */
export interface HostBodyDraftRepository {
  /** The draft, or null when there is none, it is unreadable, or storage failed. */
  load(key: HostBodyDraftKey): Promise<HostBodyDraft | null>;
  /** Stores (or replaces) the draft; false when it could not be stored. */
  save(draft: HostBodyDraft): Promise<boolean>;
  /** Deletes the draft; a missing draft or a storage failure is not an error. */
  remove(key: HostBodyDraftKey): Promise<void>;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Stable short hash of a published body (FNV-1a, 32 bit), to tell whether it changed. */
export function hashHostBodySource(source: string): string {
  let hash = FNV_OFFSET_BASIS;
  const text = source.trim();
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Shape check for a record read back from storage. */
export function isHostBodyDraftRecord(value: unknown): value is HostBodyDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.username) &&
    isNonEmptyString(record.objectId) &&
    isNonEmptyString(record.updateType) &&
    isNonEmptyString(record.body) &&
    typeof record.baseSourceHash === 'string' &&
    typeof record.updatedAt === 'number' &&
    Number.isFinite(record.updatedAt)
  );
}

export type HostBodyDraftSaveDecision = 'save' | 'remove';

/**
 * Whether the editor content is worth keeping as a draft. An empty body, or one equal to a
 * published body, is not a draft (and an existing one is removed). A body that does not
 * extract yet (HTML outside its code block) is still work in progress, so it is kept.
 */
export function decideHostBodyDraftSave(input: {
  format: HostBodyFormat;
  markdown: string;
  publishedSources: readonly string[];
}): HostBodyDraftSaveDecision {
  if (input.markdown.trim().length === 0) {
    return 'remove';
  }
  const extracted = extractHostBodyFromEditorMarkdown(input.format, input.markdown);
  if (!extracted.ok) {
    return extracted.error === 'empty' ? 'remove' : 'save';
  }
  const published = input.publishedSources.map((source) => source.trim());
  return published.includes(extracted.body) ? 'remove' : 'save';
}
