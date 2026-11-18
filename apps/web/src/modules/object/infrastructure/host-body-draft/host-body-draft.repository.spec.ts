import { IDBFactory } from 'fake-indexeddb';

import type { HostBodyDraft, HostBodyDraftRepository } from '../../domain/host-body-draft';
import { createInMemoryHostBodyDraftRepository } from './in-memory-host-body-draft.repository';
import {
  createIndexedDbHostBodyDraftRepository,
  HOST_BODY_DRAFT_DB_NAME,
  HOST_BODY_DRAFT_STORE,
} from './indexed-db-host-body-draft.repository';

function draft(overrides: Partial<HostBodyDraft> = {}): HostBodyDraft {
  return {
    username: 'alice',
    objectId: 'about-us',
    updateType: 'pageContent',
    body: '{"root":{"children":[]}}',
    baseSourceHash: 'abcd1234',
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

type AdapterFactory = {
  name: string;
  /** Two repositories over the same storage (the second simulates a reload). */
  make: () => [HostBodyDraftRepository, () => HostBodyDraftRepository];
};

const ADAPTERS: AdapterFactory[] = [
  {
    name: 'IndexedDB',
    make: () => {
      const factory = new IDBFactory();
      return [
        createIndexedDbHostBodyDraftRepository(factory),
        () => createIndexedDbHostBodyDraftRepository(factory),
      ];
    },
  },
  {
    name: 'in-memory',
    make: () => {
      const repository = createInMemoryHostBodyDraftRepository();
      return [repository, () => repository];
    },
  },
];

describe.each(ADAPTERS)('$name host body draft repository', ({ make }) => {
  it('returns null when there is no draft', async () => {
    const [repository] = make();
    await expect(repository.load({ username: 'alice', objectId: 'about-us' })).resolves.toBeNull();
  });

  it('saves, loads and replaces the draft of a user and object', async () => {
    const [repository] = make();
    await expect(repository.save(draft())).resolves.toBe(true);
    await expect(repository.load({ username: 'alice', objectId: 'about-us' })).resolves.toEqual(
      draft(),
    );

    await repository.save(draft({ body: '{"root":{"v":2}}', updatedAt: 2 }));
    await expect(repository.load({ username: 'alice', objectId: 'about-us' })).resolves.toEqual(
      draft({ body: '{"root":{"v":2}}', updatedAt: 2 }),
    );
  });

  it('keeps drafts of different users and objects apart', async () => {
    const [repository] = make();
    await repository.save(draft());
    await repository.save(draft({ username: 'bob', body: '{"root":{"bob":1}}' }));
    await repository.save(draft({ objectId: 'terms', body: '{"root":{"terms":1}}' }));

    expect((await repository.load({ username: 'bob', objectId: 'about-us' }))?.body).toBe(
      '{"root":{"bob":1}}',
    );
    expect((await repository.load({ username: 'alice', objectId: 'terms' }))?.body).toBe(
      '{"root":{"terms":1}}',
    );
    expect((await repository.load({ username: 'alice', objectId: 'about-us' }))?.body).toBe(
      draft().body,
    );
  });

  it('removes a draft and ignores a missing one', async () => {
    const [repository] = make();
    await repository.save(draft());
    await repository.remove({ username: 'alice', objectId: 'about-us' });
    await expect(repository.load({ username: 'alice', objectId: 'about-us' })).resolves.toBeNull();
    await expect(
      repository.remove({ username: 'alice', objectId: 'about-us' }),
    ).resolves.toBeUndefined();
  });

  it('keeps the draft for a new repository over the same storage (reload)', async () => {
    const [repository, reopen] = make();
    await repository.save(draft());
    await expect(reopen().load({ username: 'alice', objectId: 'about-us' })).resolves.toEqual(
      draft(),
    );
  });
});

describe('IndexedDB host body draft repository failures', () => {
  it('ignores a record that is not a draft', async () => {
    const factory = new IDBFactory();
    const repository = createIndexedDbHostBodyDraftRepository(factory);
    await repository.save(draft());

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(HOST_BODY_DRAFT_DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(HOST_BODY_DRAFT_STORE, 'readwrite');
      transaction.objectStore(HOST_BODY_DRAFT_STORE).put({ username: 'alice', objectId: 'about-us', body: 7 });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();

    await expect(repository.load({ username: 'alice', objectId: 'about-us' })).resolves.toBeNull();
  });

  it('never rejects when the database cannot be opened', async () => {
    const broken = {
      open: () => {
        throw new Error('storage disabled');
      },
    } as unknown as IDBFactory;
    const repository = createIndexedDbHostBodyDraftRepository(broken);

    await expect(repository.load({ username: 'alice', objectId: 'about-us' })).resolves.toBeNull();
    await expect(repository.save(draft())).resolves.toBe(false);
    await expect(
      repository.remove({ username: 'alice', objectId: 'about-us' }),
    ).resolves.toBeUndefined();
  });
});
