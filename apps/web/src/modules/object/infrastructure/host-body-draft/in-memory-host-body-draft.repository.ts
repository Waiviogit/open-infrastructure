import type {
  HostBodyDraft,
  HostBodyDraftKey,
  HostBodyDraftRepository,
} from '../../domain/host-body-draft';

function mapKey(key: HostBodyDraftKey): string {
  return JSON.stringify([key.username, key.objectId]);
}

/** Drafts for this page load only: the fallback without IndexedDB (and the test double). */
export function createInMemoryHostBodyDraftRepository(): HostBodyDraftRepository {
  const drafts = new Map<string, HostBodyDraft>();

  return {
    async load(key) {
      const draft = drafts.get(mapKey(key));
      return draft ? { ...draft } : null;
    },
    async save(draft) {
      drafts.set(mapKey(draft), { ...draft });
      return true;
    },
    async remove(key) {
      drafts.delete(mapKey(key));
    },
  };
}
