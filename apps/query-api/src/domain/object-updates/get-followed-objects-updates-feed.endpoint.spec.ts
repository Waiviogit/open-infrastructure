import { DEFAULT_GOVERNANCE_SNAPSHOT } from '@opden-data-layer/objects-domain';

import type { UpdatesFeedJoinRow } from '../../repositories';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import * as projectFeedObjects from '../feed/project-feed-objects';
import {
  GetFollowedObjectsUpdatesFeedEndpoint,
  groupJoinRowsByObjectId,
} from './get-followed-objects-updates-feed.endpoint';
import type { ObjectUpdateFeedItemDto } from './schemas/object-updates-feed.schema';
import { decodeUpdatesCursor, encodeUpdatesCursor } from './updates-cursor';

jest.mock('../feed/project-feed-objects', () => ({
  projectFeedObjectsById: jest.fn(),
}));

const projectMock = projectFeedObjects.projectFeedObjectsById as jest.MockedFunction<
  typeof projectFeedObjects.projectFeedObjectsById
>;

function joinRow(updateId: string, objectId: string, createdAt: number): UpdatesFeedJoinRow {
  return {
    row: { update_id: updateId, object_id: objectId, created_at_unix: createdAt },
    creator_wobjects_weight: 0,
    geo_lat: null,
    geo_lon: null,
  } as unknown as UpdatesFeedJoinRow;
}

function dto(updateId: string, objectId: string): ObjectUpdateFeedItemDto {
  return { update_id: updateId, object_id: objectId } as ObjectUpdateFeedItemDto;
}

describe('groupJoinRowsByObjectId', () => {
  it('groups rows by object and keeps row order inside each group', () => {
    const groups = groupJoinRowsByObjectId([
      joinRow('u1', 'a', 3),
      joinRow('u2', 'b', 2),
      joinRow('u3', 'a', 1),
    ]);

    expect([...groups.keys()]).toEqual(['a', 'b']);
    expect(groups.get('a')?.map((jr) => jr.row.update_id)).toEqual(['u1', 'u3']);
  });
});

describe('GetFollowedObjectsUpdatesFeedEndpoint', () => {
  const accounts = { findByName: jest.fn() };
  const updatesFeedRepo = { findFollowedObjectsRecencyPage: jest.fn() };
  const objectOwnershipRepo = { findByObjectId: jest.fn() };
  const governanceResolver = { resolveMergedForObjectView: jest.fn() };
  const itemsBuilder = { buildForObject: jest.fn() };

  const endpoint = new GetFollowedObjectsUpdatesFeedEndpoint(
    accounts as never,
    updatesFeedRepo as never,
    objectOwnershipRepo as never,
    governanceResolver as never,
    itemsBuilder as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accounts.findByName.mockResolvedValue({ name: 'alice' });
    updatesFeedRepo.findFollowedObjectsRecencyPage.mockResolvedValue([]);
    objectOwnershipRepo.findByObjectId.mockResolvedValue([]);
    governanceResolver.resolveMergedForObjectView.mockResolvedValue(DEFAULT_GOVERNANCE_SNAPSHOT);
    itemsBuilder.buildForObject.mockImplementation(
      async (objectId: string, rows: UpdatesFeedJoinRow[]) =>
        rows.map((jr) => dto(jr.row.update_id, objectId)),
    );
    projectMock.mockResolvedValue(new Map());
  });

  it('returns null when the account does not exist', async () => {
    accounts.findByName.mockResolvedValue(undefined);

    const result = await endpoint.execute('ghost', { limit: 20 }, 'en-US');

    expect(result).toBeNull();
  });

  it('returns an empty page for an approval cursor', async () => {
    const cursor = encodeUpdatesCursor({ kind: 'approval', offset: 20 });

    const result = await endpoint.execute('alice', { limit: 20, cursor }, 'en-US');

    expect(result).toEqual({ items: [], cursor: null, hasMore: false });
    expect(updatesFeedRepo.findFollowedObjectsRecencyPage).not.toHaveBeenCalled();
  });

  it('passes the recency cursor to the repository', async () => {
    const cursor = encodeUpdatesCursor({ kind: 'recency', created_at_unix: 50, update_id: 'u9' });

    await endpoint.execute('alice', { limit: 5, cursor }, 'en-US');

    expect(updatesFeedRepo.findFollowedObjectsRecencyPage).toHaveBeenCalledWith({
      account: 'alice',
      limit: 6,
      cursorCreatedAt: 50,
      cursorUpdateId: 'u9',
    });
  });

  it('keeps recency order across objects and attaches the projected object', async () => {
    updatesFeedRepo.findFollowedObjectsRecencyPage.mockResolvedValue([
      joinRow('u1', 'a', 30),
      joinRow('u2', 'b', 20),
      joinRow('u3', 'a', 10),
    ]);
    projectMock.mockResolvedValue(new Map([['a', { object_id: 'a' } as ProjectedObject]]));

    const result = await endpoint.execute('alice', { limit: 5 }, 'en-US', undefined, 'carol');

    expect(itemsBuilder.buildForObject).toHaveBeenCalledTimes(2);
    expect(objectOwnershipRepo.findByObjectId).toHaveBeenCalledWith('a');
    expect(objectOwnershipRepo.findByObjectId).toHaveBeenCalledWith('b');
    expect(result?.items.map((item) => item.update_id)).toEqual(['u1', 'u2', 'u3']);
    expect(result?.items.map((item) => item.object?.object_id ?? null)).toEqual(['a', null, 'a']);
    expect(result?.hasMore).toBe(false);
    expect(result?.cursor).toBeNull();
  });

  it('returns a recency cursor from the last row when more rows exist', async () => {
    updatesFeedRepo.findFollowedObjectsRecencyPage.mockResolvedValue([
      joinRow('u1', 'a', 30),
      joinRow('u2', 'a', 20),
      joinRow('u3', 'a', 10),
    ]);

    const result = await endpoint.execute('alice', { limit: 2 }, 'en-US');

    expect(result?.items).toHaveLength(2);
    expect(result?.hasMore).toBe(true);
    expect(decodeUpdatesCursor(result?.cursor ?? '')).toEqual({
      kind: 'recency',
      created_at_unix: 20,
      update_id: 'u2',
    });
  });
});
