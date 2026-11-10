import {
  buildObjectActivityMessagePath,
  isObjectActivityMessagePath,
  resolveActivityMessageHref,
} from './activity-message-permalink';

describe('activity message permalink', () => {
  it('builds /object/:id/social/activity/:messageId', () => {
    expect(buildObjectActivityMessagePath('justin-bellware', 'abc-0-0-1')).toBe(
      '/object/justin-bellware/social/activity/abc-0-0-1',
    );
  });

  it('prefers the feed object over the row source object', () => {
    expect(
      resolveActivityMessageHref(
        { message_id: 'm1', source_object: { object_id: 'rest-1', name: 'Bistro' } },
        'dish-1',
      ),
    ).toBe('/object/dish-1/social/activity/m1');
  });

  it('falls back to the row source object on multi-object feeds', () => {
    expect(
      resolveActivityMessageHref({
        message_id: 'm1',
        source_object: { object_id: 'rest-1', name: 'Bistro' },
      }),
    ).toBe('/object/rest-1/social/activity/m1');
  });

  it('returns null when no object is known', () => {
    expect(resolveActivityMessageHref({ message_id: 'm1', source_object: null })).toBeNull();
  });

  it('recognises permalink paths only', () => {
    expect(isObjectActivityMessagePath('/object/a/social/activity/m1')).toBe(true);
    expect(isObjectActivityMessagePath('/object/a/social/activity')).toBe(false);
    expect(isObjectActivityMessagePath('/feed/activity')).toBe(false);
  });
});
