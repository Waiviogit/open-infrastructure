import {
  isHostBodyDraftRecord,
  type HostBodyDraft,
  type HostBodyDraftKey,
  type HostBodyDraftRepository,
} from '../../domain/host-body-draft';

/** Own database, so its version never has to move with other browser storage. */
export const HOST_BODY_DRAFT_DB_NAME = 'odl-web-object-body-drafts';
const HOST_BODY_DRAFT_DB_VERSION = 1;
export const HOST_BODY_DRAFT_STORE = 'drafts';
/** For a later "drafts of this user" list or clear on logout without a version bump. */
const BY_USERNAME_INDEX = 'by_username';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(HOST_BODY_DRAFT_DB_NAME, HOST_BODY_DRAFT_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        const store = db.createObjectStore(HOST_BODY_DRAFT_STORE, {
          keyPath: ['username', 'objectId'],
        });
        store.createIndex(BY_USERNAME_INDEX, 'username', { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading the schema must not be blocked by this connection.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function storageKey(key: HostBodyDraftKey): IDBValidKey {
  return [key.username, key.objectId];
}

/**
 * Drafts in the browser's IndexedDB. Every failure (no storage in private mode, quota, a closed
 * connection) is swallowed: reads return null, writes return false.
 */
export function createIndexedDbHostBodyDraftRepository(
  factory: IDBFactory,
): HostBodyDraftRepository {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const database = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = openDatabase(factory).catch((error: unknown) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  };

  return {
    async load(key) {
      try {
        const db = await database();
        const store = db.transaction(HOST_BODY_DRAFT_STORE, 'readonly').objectStore(HOST_BODY_DRAFT_STORE);
        const record: unknown = await requestResult(store.get(storageKey(key)));
        return isHostBodyDraftRecord(record) ? record : null;
      } catch {
        return null;
      }
    },

    async save(draft: HostBodyDraft) {
      try {
        const db = await database();
        const transaction = db.transaction(HOST_BODY_DRAFT_STORE, 'readwrite');
        transaction.objectStore(HOST_BODY_DRAFT_STORE).put({
          username: draft.username,
          objectId: draft.objectId,
          updateType: draft.updateType,
          body: draft.body,
          baseSourceHash: draft.baseSourceHash,
          updatedAt: draft.updatedAt,
        });
        await transactionDone(transaction);
        return true;
      } catch {
        return false;
      }
    },

    async remove(key) {
      try {
        const db = await database();
        const transaction = db.transaction(HOST_BODY_DRAFT_STORE, 'readwrite');
        transaction.objectStore(HOST_BODY_DRAFT_STORE).delete(storageKey(key));
        await transactionDone(transaction);
      } catch {
        // A draft that cannot be removed is shown again next time; nothing else to do.
      }
    },
  };
}
