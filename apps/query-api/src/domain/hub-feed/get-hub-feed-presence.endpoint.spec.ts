import { GetHubFeedPresenceEndpoint } from './get-hub-feed-presence.endpoint';
import { hubFeedPresenceQuerySchema } from './schemas/hub-feed-filters.schema';

describe('GetHubFeedPresenceEndpoint', () => {
  it('returns present tabs in hub order for an author or an object', async () => {
    const repo = { findTabs: jest.fn().mockResolvedValue(['updates', 'posts']) };
    const endpoint = new GetHubFeedPresenceEndpoint(repo as never);

    await expect(endpoint.execute(hubFeedPresenceQuerySchema.parse({ author: '@Alice' }))).resolves.toEqual({
      tabs: ['posts', 'updates'],
    });
    expect(repo.findTabs).toHaveBeenCalledWith('user', 'alice');

    await endpoint.execute(hubFeedPresenceQuerySchema.parse({ object: 'obj-1' }));
    expect(repo.findTabs).toHaveBeenLastCalledWith('object', 'obj-1');
  });

  it('treats a failed lookup as present nowhere', async () => {
    const endpoint = new GetHubFeedPresenceEndpoint({ findTabs: jest.fn().mockResolvedValue(null) } as never);
    await expect(endpoint.execute({ object: 'obj-1' })).resolves.toEqual({ tabs: [] });
  });

  it('requires exactly one of author / object', () => {
    expect(hubFeedPresenceQuerySchema.safeParse({}).success).toBe(false);
    expect(hubFeedPresenceQuerySchema.safeParse({ author: 'alice', object: 'x' }).success).toBe(false);
  });
});
