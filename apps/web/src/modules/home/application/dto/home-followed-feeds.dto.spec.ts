import {
  homeActivityFeedResponseSchema,
  homeUpdatesFeedResponseSchema,
  mapFollowedObjectMessageToItem,
} from './home-followed-feeds.dto';

const message = {
  message_id: 'm1',
  channel_id: 'c1',
  author: 'alice',
  body: 'hello',
  created_at_unix: 100,
  source_object: null,
  object: { object_id: 'cafe-1', name: 'Cafe' },
};

describe('mapFollowedObjectMessageToItem', () => {
  it('uses the followed object as the message source and drops `object`', () => {
    const parsed = homeActivityFeedResponseSchema.parse({
      items: [message],
      cursor: null,
      hasMore: false,
    });

    const item = mapFollowedObjectMessageToItem(parsed.items[0]);

    expect(item.source_object).toEqual({ object_id: 'cafe-1', name: 'Cafe' });
    expect(item.body).toBe('hello');
    expect('object' in item).toBe(false);
  });

  it('keeps an existing cross-post source', () => {
    const parsed = homeActivityFeedResponseSchema.parse({
      items: [{ ...message, source_object: { object_id: 'other', name: 'Other' } }],
      cursor: null,
      hasMore: false,
    });

    expect(mapFollowedObjectMessageToItem(parsed.items[0]).source_object).toEqual({
      object_id: 'other',
      name: 'Other',
    });
  });
});

describe('homeUpdatesFeedResponseSchema', () => {
  const update = {
    update_id: 'u1',
    object_id: 'cafe-1',
    update_type: 'name',
    creator: 'alice',
    creator_wobjects_weight: '5',
    locale: 'en-US',
    created_at_unix: 100,
    transaction_id: 'tx',
    value_text: 'Cafe',
    value_geo: null,
    value_json: null,
    approve_percent: 100,
    for_vote_count: 1,
    against_vote_count: 0,
    viewer_vote: null,
  };

  it('defaults a missing object to null', () => {
    const parsed = homeUpdatesFeedResponseSchema.parse({
      items: [update],
      cursor: 'next',
      hasMore: true,
    });

    expect(parsed.items[0].object).toBeNull();
    expect(parsed.items[0].creator_wobjects_weight).toBe(5);
  });

  it('parses the projected object', () => {
    const parsed = homeUpdatesFeedResponseSchema.parse({
      items: [
        {
          ...update,
          object: {
            object_id: 'cafe-1',
            object_type: 'restaurant',
            semantic_type: null,
            fields: { name: 'Cafe' },
          },
        },
      ],
      cursor: null,
      hasMore: false,
    });

    expect(parsed.items[0].object?.fields).toEqual({ name: 'Cafe' });
  });
});
