import type { HostBodyDraftRepository } from '../../domain/host-body-draft';
import { createInMemoryHostBodyDraftRepository } from './in-memory-host-body-draft.repository';
import { createIndexedDbHostBodyDraftRepository } from './indexed-db-host-body-draft.repository';

let repository: HostBodyDraftRepository | null = null;

/**
 * The drafts store the app uses. Drafts live in this browser (IndexedDB) for now; moving them to
 * the backend means returning an HTTP adapter here — callers only see the port.
 */
export function getHostBodyDraftRepository(): HostBodyDraftRepository {
  if (!repository) {
    repository =
      typeof indexedDB !== 'undefined'
        ? createIndexedDbHostBodyDraftRepository(indexedDB)
        : createInMemoryHostBodyDraftRepository();
  }
  return repository;
}
