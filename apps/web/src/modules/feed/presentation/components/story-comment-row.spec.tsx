/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import type { PostDiscussionView } from '../../application/dto/post-discussion.dto';
import type { DiscussionCommentView } from '../../application/mappers/feed-story-from-api.mapper';

import { StoryCommentRow } from './story-comment-row';

const mockLoadEditTarget = jest.fn();

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en-US' }),
}));

jest.mock(
  '../../infrastructure/actions/load-comment-edit-target.action',
  () => ({
    loadCommentEditTargetAction: (...args: unknown[]) =>
      mockLoadEditTarget(...args),
  }),
);

jest.mock('@/shared/presentation', () => ({
  SocialEmbedHtml: ({ html }: { html: string }) => (
    <div data-testid="comment-body">{html}</div>
  ),
  UserAvatar: () => null,
}));

jest.mock('@/shared/infrastructure/post-body-html-pipeline', () => ({
  sanitizePostBodyHtml: (body: string) => body,
}));

jest.mock('./story-vote-button', () => ({ StoryVoteButton: () => null }));
jest.mock('./story-reward-badge', () => ({ StoryRewardBadge: () => null }));
jest.mock('./story-comment-editor', () => ({
  StoryCommentEditor: ({
    editTarget,
    onCancel,
  }: {
    editTarget?: { body: string };
    onCancel?: () => void;
  }) =>
    editTarget ? (
      <div data-testid="inline-editor">
        {editTarget.body}
        <button type="button" onClick={onCancel}>
          cancel
        </button>
      </div>
    ) : (
      <div data-testid="reply-editor" />
    ),
}));

const comment = {
  id: 'alice/re-root',
  authorName: 'alice',
  permlink: 're-root',
  parentAuthor: 'bob',
  createdAt: '2024-01-01T00:00:00.000Z',
  excerpt: 'Hi',
  body: 'Hi **there**',
} as DiscussionCommentView;

const discussion = {
  childrenById: {},
  comments: {},
} as unknown as PostDiscussionView;
const rootStory = { authorName: 'bob', permlink: 'root' } as FeedStoryView;

function renderRow(currentUsername: string | null) {
  return render(
    <StoryCommentRow
      comment={comment}
      discussion={discussion}
      rootStory={rootStory}
      currentUsername={currentUsername}
      onDiscussionRefresh={jest.fn()}
    />,
  );
}

describe('StoryCommentRow edit', () => {
  beforeEach(() => {
    mockLoadEditTarget.mockReset();
  });

  it("shows Edit only on the viewer's own comment", () => {
    const { unmount } = renderRow('bob');
    expect(screen.queryByRole('button', { name: 'edit' })).toBeNull();
    unmount();

    renderRow('alice');
    expect(screen.getByRole('button', { name: 'edit' })).toBeInTheDocument();
  });

  it('swaps the body for the inline editor with the loaded comment, and Cancel restores it', async () => {
    mockLoadEditTarget.mockResolvedValue({
      ok: true,
      value: {
        author: 'alice',
        permlink: 're-root',
        parentAuthor: 'bob',
        parentPermlink: 'root',
        title: '',
        body: 'Hi **there** (raw)',
        jsonMetadata: '{}',
      },
    });
    renderRow('alice');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    expect(await screen.findByTestId('inline-editor')).toHaveTextContent(
      'Hi **there** (raw)',
    );
    expect(screen.queryByTestId('comment-body')).toBeNull();
    expect(mockLoadEditTarget).toHaveBeenCalledWith('alice', 're-root');

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() =>
      expect(screen.getByTestId('comment-body')).toBeInTheDocument(),
    );
  });

  it('shows an inline error when the comment cannot be loaded', async () => {
    mockLoadEditTarget.mockResolvedValue({
      ok: false,
      error: 'service_unavailable',
    });
    renderRow('alice');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'comment_edit_load_failed',
    );
  });
});
