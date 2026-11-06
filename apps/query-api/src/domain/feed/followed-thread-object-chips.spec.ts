import type { ProjectedObject } from '../object-projection/projected-object.types';
import type { FeedStoryItemDto } from './feed-story-dtos';
import { attachFollowedThreadObjectChips } from './followed-thread-object-chips';

function item(id: string): FeedStoryItemDto {
  return { id, objects: [] } as unknown as FeedStoryItemDto;
}

function projected(objectId: string): ProjectedObject {
  return { object_id: objectId } as ProjectedObject;
}

describe('attachFollowedThreadObjectChips', () => {
  const projectedById = new Map([
    ['a', projected('a')],
    ['b', projected('b')],
    ['c', projected('c')],
  ]);

  it('keeps hashtag order and drops objects that are not projected', () => {
    const [result] = attachFollowedThreadObjectChips(
      [item('x/1')],
      new Map([['x/1', ['c', 'unknown', 'a']]]),
      projectedById,
      4,
    );

    expect(result.objects.map((o) => o.object_id)).toEqual(['c', 'a']);
  });

  it('dedupes repeated hashtags and caps at the limit', () => {
    const [result] = attachFollowedThreadObjectChips(
      [item('x/1')],
      new Map([['x/1', ['a', 'a', 'b', 'c']]]),
      projectedById,
      2,
    );

    expect(result.objects.map((o) => o.object_id)).toEqual(['a', 'b']);
  });

  it('returns no chips for items without hashtags', () => {
    const [result] = attachFollowedThreadObjectChips([item('x/1')], new Map(), projectedById, 4);

    expect(result.objects).toEqual([]);
  });
});
