import { GetHubActivityFeedEndpoint } from './get-hub-activity-feed.endpoint';
import { decodeHubFeedCursor, hubActivityCursorSchema } from './hub-feed-cursor';
import { hubActivityFeedBodySchema } from './schemas/hub-feed.schema';

const message = (id: string, created: number, seq: number) => ({
  message_id: id,
  channel_id: 'ch',
  author: 'alice',
  body: 'body',
  mentions: [],
  linked_object_ids: [],
  created_at_unix: created,
  original_created_at_unix: null,
  updated_at_unix: null,
  event_seq: BigInt(seq),
  dup_group_id: id,
  channel_object_id: 'obj',
  duplicate_count: 1,
});

function setup() {
  const rows = [message('m1', 300, 30), message('m2', 200, 20), message('m3', 100, 10)];
  const hubActivityRepo = {
    findNew: jest.fn().mockResolvedValue(rows),
    findMy: jest.fn().mockResolvedValue([]),
    findByAuthor: jest.fn().mockResolvedValue([]),
  };
  const messagingRepo = {
    listObjectActivityMessages: jest.fn().mockResolvedValue([]),
    findObjectChannelTitles: jest.fn().mockResolvedValue(new Map([['obj', 'Object']])),
  };
  const governance = {
    resolveMergedForObjectView: jest.fn().mockResolvedValue({ muted: ['gov-muted'], authors: [] }),
  };
  const mutes = { listMutedForMuters: jest.fn().mockResolvedValue(['viewer-muted']) };
  const endpoint = new GetHubActivityFeedEndpoint(
    hubActivityRepo as never,
    messagingRepo as never,
    governance as never,
    mutes as never,
  );
  return { endpoint, hubActivityRepo, messagingRepo, governance };
}

const body = (raw: Record<string, unknown>) => hubActivityFeedBodySchema.parse(raw);

describe('GetHubActivityFeedEndpoint', () => {
  it('applies governance and viewer mutes, and pages by effective time + event sequence', async () => {
    const { endpoint, hubActivityRepo } = setup();

    const page = await endpoint.execute(body({ limit: 2 }), undefined, 'viewer');

    expect(hubActivityRepo.findNew).toHaveBeenCalledWith(['gov-muted', 'viewer-muted'], null, 3);
    expect(page.items.map((item) => item.object)).toEqual([
      { object_id: 'obj', name: 'Object' },
      { object_id: 'obj', name: 'Object' },
    ]);
    expect(decodeHubFeedCursor(page.cursor ?? '', 'new', hubActivityCursorSchema)).toEqual({
      createdAtUnix: 200,
      eventSeq: '20',
    });
  });

  it('reads one object through the object activity query and normalizes driver values', async () => {
    const { endpoint, messagingRepo } = setup();
    messagingRepo.listObjectActivityMessages.mockResolvedValue([
      { ...message('m1', 300, 30), created_at_unix: '300', event_seq: '30', duplicate_count: '2' },
    ]);

    const page = await endpoint.execute(
      body({ filter: { kind: 'object', object_id: 'obj' } }),
      undefined,
      undefined,
    );

    expect(messagingRepo.listObjectActivityMessages).toHaveBeenCalledWith('obj', ['gov-muted'], null, 21);
    expect(page.items[0].created_at_unix).toBe(300);
  });

  it('shows an explicitly chosen author without mute lookups', async () => {
    const { endpoint, hubActivityRepo, governance } = setup();

    await endpoint.execute(body({ filter: { kind: 'author', account: 'bob' } }), undefined, 'viewer');

    expect(hubActivityRepo.findByAuthor).toHaveBeenCalledWith('bob', null, 21);
    expect(governance.resolveMergedForObjectView).not.toHaveBeenCalled();
  });
});
