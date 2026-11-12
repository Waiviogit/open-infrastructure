/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { imageContentUrlForCid } from '@/config/ipfs-content-url';

import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import { StoryCommentEditor } from './story-comment-editor';

const CONTENT_BASE = 'https://content.example';

const mockBroadcast = jest.fn();
const mockBuildCommentOp = jest.fn((input: Record<string, unknown>) => ({
  type: 'comment',
  ...input,
}));

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en-US' }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/config/ipfs-content-base-provider', () => ({
  useIpfsContentBaseUrl: () => 'https://content.example',
}));

jest.mock('@/modules/auth', () => ({
  buildCommentOp: (input: Record<string, unknown>) => mockBuildCommentOp(input),
  getWalletFacade: () => ({ broadcast: mockBroadcast }),
  useHydrateWalletProvider: jest.fn(),
}));

jest.mock('@/shared', () => ({
  ...jest.requireActual('@/shared/domain/hive-json-metadata'),
  ...jest.requireActual('@/shared/domain/hive-permlink'),
}));

jest.mock('@/modules/notifications', () => ({
  awaitTrxConfirmation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/shared/infrastructure/query/refresh-after-broadcast', () => ({
  refreshAfterBroadcast: jest.fn().mockResolvedValue(undefined),
}));

jest.mock(
  '@/shared/infrastructure/query/revalidate-after-broadcast.server',
  () => ({
    revalidateHomeFeedAfterBroadcast: jest.fn().mockResolvedValue(undefined),
    revalidateUserFeedAfterBroadcast: jest.fn().mockResolvedValue(undefined),
  }),
);

/** The editor is replaced by a field that emits Lexical JSON, as the real one does. */
jest.mock('@/modules/editor', () => {
  const { editorBodyToMarkdown } = jest.requireActual<
    typeof import('@/modules/editor/application/editor-body-to-markdown')
  >('@/modules/editor/application/editor-body-to-markdown');
  return {
    editorBodyToMarkdown,
    CompactComposeEditor: ({
      onBodyChange,
      onSend,
      canSend,
      sendAriaLabel,
      initialBody,
      footer,
    }: {
      onBodyChange: (bodyLexicalJson: string) => void;
      onSend: () => void;
      canSend: boolean;
      sendAriaLabel: string;
      initialBody?: string;
      footer?: ReactNode;
    }) => (
      <>
        <textarea
          aria-label="comment"
          data-initial-body={initialBody ?? ''}
          onChange={(event) => onBodyChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={sendAriaLabel}
          disabled={!canSend}
          onClick={onSend}
        />
        {footer}
      </>
    ),
  };
});

const story = { authorName: 'bob', permlink: 'root-post' } as FeedStoryView;

const richBody = JSON.stringify({
  root: {
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Great ', format: 0 },
          { type: 'text', text: 'shot', format: 1 },
          { type: 'text', text: ' of ', format: 0 },
          {
            type: 'link',
            url: 'https://waivio.com/object/fire-rock',
            children: [{ type: 'text', text: 'Fire Rock', format: 0 }],
          },
          { type: 'text', text: ' #my_tag', format: 0 },
        ],
      },
      {
        type: 'post-image',
        cid: 'QmPhoto',
        src: '',
        altText: 'photo',
        children: [],
      },
    ],
  },
});

describe('StoryCommentEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBroadcast.mockResolvedValue({ transactionId: 'tx-1' });
  });

  it('broadcasts the editor body as markdown: bold, link href, image URL and hashtag survive', async () => {
    render(<StoryCommentEditor story={story} currentUsername="alice" />);

    fireEvent.change(screen.getByLabelText('comment'), {
      target: { value: richBody },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

    await waitFor(() => expect(mockBroadcast).toHaveBeenCalledTimes(1));
    expect(mockBuildCommentOp).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_author: 'bob',
        parent_permlink: 'root-post',
        author: 'alice',
        title: '',
        body: `Great **shot** of [Fire Rock](https://waivio.com/object/fire-rock) #my_tag\n\n![photo](${imageContentUrlForCid(CONTENT_BASE, 'QmPhoto')})`,
      }),
    );
  });

  it('keeps Send disabled for an empty document', () => {
    render(<StoryCommentEditor story={story} currentUsername="alice" />);

    fireEvent.change(screen.getByLabelText('comment'), {
      target: {
        value: JSON.stringify({
          root: { children: [{ type: 'paragraph', children: [] }] },
        }),
      },
    });

    expect(
      screen.getByRole('button', { name: 'Submit comment' }),
    ).toBeDisabled();
  });

  describe('edit mode', () => {
    const editTarget = {
      author: 'alice',
      permlink: 're-bob-root-post-1',
      parentAuthor: 'bob',
      parentPermlink: 'root-post',
      title: '',
      body: 'Old **text**',
      jsonMetadata: JSON.stringify({
        app: 'other/1.0',
        tags: ['hive'],
        format: 'markdown',
      }),
    };

    function lexicalParagraph(text: string): string {
      return JSON.stringify({
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text, format: 0 }],
            },
          ],
        },
      });
    }

    it('seeds the editor with the published markdown', () => {
      render(
        <StoryCommentEditor
          story={story}
          currentUsername="alice"
          editTarget={editTarget}
        />,
      );

      expect(screen.getByLabelText('comment')).toHaveAttribute(
        'data-initial-body',
        'Old **text**',
      );
    });

    it('re-broadcasts the same permlink and parent with merged json_metadata, then calls onSaved', async () => {
      const onSaved = jest.fn();
      render(
        <StoryCommentEditor
          story={story}
          currentUsername="alice"
          editTarget={editTarget}
          onSaved={onSaved}
        />,
      );

      fireEvent.change(screen.getByLabelText('comment'), {
        target: { value: lexicalParagraph('New text') },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'comment_update_send' }),
      );

      await waitFor(() => expect(mockBroadcast).toHaveBeenCalledTimes(1));
      const [op] = mockBroadcast.mock.calls[0][0].operations;
      expect(op).toMatchObject({
        type: 'comment',
        author: 'alice',
        permlink: 're-bob-root-post-1',
        parent_author: 'bob',
        parent_permlink: 'root-post',
        title: '',
        body: 'New text',
      });
      expect(JSON.parse(op.json_metadata)).toMatchObject({
        tags: ['hive'],
        format: 'markdown',
      });
      expect(mockBuildCommentOp).not.toHaveBeenCalled();
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    });

    it('shows the broadcast error inline and keeps the editor open', async () => {
      mockBroadcast.mockRejectedValue(new Error('User rejected'));
      const onSaved = jest.fn();
      render(
        <StoryCommentEditor
          story={story}
          currentUsername="alice"
          editTarget={editTarget}
          onSaved={onSaved}
        />,
      );

      fireEvent.change(screen.getByLabelText('comment'), {
        target: { value: lexicalParagraph('New text') },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'comment_update_send' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'User rejected',
      );
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('Cancel leaves without broadcasting', () => {
      const onCancel = jest.fn();
      render(
        <StoryCommentEditor
          story={story}
          currentUsername="alice"
          editTarget={editTarget}
          onCancel={onCancel}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });
});
