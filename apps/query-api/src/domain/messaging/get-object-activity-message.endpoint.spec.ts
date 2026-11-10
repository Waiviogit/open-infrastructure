import { GetObjectActivityMessageEndpoint } from './get-object-activity-message.endpoint';
import type { MessagingRepository, ObjectActivityMessageRow } from '../../repositories/messaging.repository';
import type { ObjectsCoreRepository } from '../../repositories/objects-core.repository';
import type { GovernanceResolverService } from '../governance';
import type { UserAccountMutesRepository } from '../../repositories';

function makeRow(overrides: Partial<ObjectActivityMessageRow> = {}): ObjectActivityMessageRow {
  return {
    message_id: 'tx1-0-0-0',
    channel_id: 'obj-ch-dish-1',
    channel_object_id: 'dish-1',
    author: 'alice',
    body: 'https://www.instagram.com/reel/abc/',
    encrypted_body: null,
    encryption_mode: null,
    encrypted_to: null,
    encryption_v: null,
    encryption_meta: null,
    overflow_ref: null,
    reply_to: null,
    quote_json: null,
    attachments: null,
    mentions: [],
    linked_object_ids: [],
    source_platform: 'instagram',
    source_id: 'abc',
    text_simhash: null,
    image_phashes: [],
    fingerprint_v: null,
    dup_group_id: 'tx1-0-0-0',
    original_created_at_unix: 1_700_000_000,
    updated_at_unix: null,
    created_at_unix: 1_700_000_100,
    event_seq: BigInt(1),
    transaction_id: 'tx1',
    search_vector: null,
    duplicate_count: 1,
    ...overrides,
  } as ObjectActivityMessageRow;
}

describe('GetObjectActivityMessageEndpoint', () => {
  const objectId = 'dish-1';
  const messageId = 'tx1-0-0-0';

  function makeEndpoint(overrides: {
    messaging?: Partial<MessagingRepository>;
    objectsCore?: Partial<ObjectsCoreRepository>;
    governance?: Partial<GovernanceResolverService>;
    mutes?: Partial<UserAccountMutesRepository>;
  } = {}) {
    const objectsCore = {
      findByObjectIdForPage: jest.fn().mockResolvedValue({ object_id: objectId }),
      ...overrides.objectsCore,
    } as unknown as ObjectsCoreRepository;

    const messaging = {
      findObjectActivityMessage: jest.fn().mockResolvedValue(makeRow()),
      findObjectChannelTitles: jest.fn().mockResolvedValue(new Map()),
      ...overrides.messaging,
    } as unknown as MessagingRepository;

    const governance = {
      resolveMergedForObjectView: jest.fn().mockResolvedValue({ muted: ['spammer'] }),
      ...overrides.governance,
    } as unknown as GovernanceResolverService;

    const mutes = {
      listMutedForMuters: jest.fn().mockResolvedValue(['troll']),
      ...overrides.mutes,
    } as unknown as UserAccountMutesRepository;

    return {
      endpoint: new GetObjectActivityMessageEndpoint(objectsCore, messaging, governance, mutes),
      messaging,
      mutes,
    };
  }

  it('returns the message mapped to the feed DTO', async () => {
    const { endpoint } = makeEndpoint();

    const result = await endpoint.execute({ objectId, messageId });

    expect(result).toMatchObject({
      message_id: messageId,
      author: 'alice',
      source_object: null,
      source: { platform: 'instagram', id: 'abc' },
      duplicate_of: null,
      duplicate_count: 1,
    });
  });

  it('passes governance and viewer mutes to the repository', async () => {
    const { endpoint, messaging, mutes } = makeEndpoint();

    await endpoint.execute({ objectId, messageId, viewerAccount: ' bob ' });

    expect(mutes.listMutedForMuters).toHaveBeenCalledWith(['bob']);
    expect(messaging.findObjectActivityMessage).toHaveBeenCalledWith(objectId, messageId, [
      'spammer',
      'troll',
    ]);
  });

  it('sets source_object when the message comes from another object channel', async () => {
    const { endpoint, messaging } = makeEndpoint({
      messaging: {
        findObjectActivityMessage: jest.fn().mockResolvedValue(
          makeRow({ channel_object_id: 'rest-1', linked_object_ids: [objectId] }),
        ),
        findObjectChannelTitles: jest.fn().mockResolvedValue(new Map([['rest-1', 'Bistro']])),
      },
    });

    const result = await endpoint.execute({ objectId, messageId });

    expect(messaging.findObjectChannelTitles).toHaveBeenCalledWith(['rest-1']);
    expect(result?.source_object).toEqual({ object_id: 'rest-1', name: 'Bistro' });
  });

  it('returns null when the object does not exist', async () => {
    const { endpoint, messaging } = makeEndpoint({
      objectsCore: { findByObjectIdForPage: jest.fn().mockResolvedValue(undefined) },
    });

    await expect(endpoint.execute({ objectId: 'missing', messageId })).resolves.toBeNull();
    expect(messaging.findObjectActivityMessage).not.toHaveBeenCalled();
  });

  it('returns null when the message is not visible on the object', async () => {
    const { endpoint } = makeEndpoint({
      messaging: { findObjectActivityMessage: jest.fn().mockResolvedValue(undefined) },
    });

    await expect(endpoint.execute({ objectId, messageId: 'other' })).resolves.toBeNull();
  });

  it('returns null for blank ids', async () => {
    const { endpoint } = makeEndpoint();

    await expect(endpoint.execute({ objectId: ' ', messageId })).resolves.toBeNull();
    await expect(endpoint.execute({ objectId, messageId: '' })).resolves.toBeNull();
  });
});
