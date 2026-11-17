/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { StoryOverflowMenu, type StoryObjectReviewMenu } from './story-overflow-menu';

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en-US' }),
}));

jest.mock('@/modules/auth', () => ({
  useLoginModal: () => ({ openLogin: jest.fn() }),
}));

function openMenu() {
  fireEvent.click(
    screen.getByRole('button', { name: 'feed_story_menu_more_aria' }),
  );
}

describe('StoryOverflowMenu edit entry', () => {
  it('links a root post to /editor', () => {
    render(
      <StoryOverflowMenu
        authorName="alice"
        editHref="/editor?author=alice&permlink=p"
        currentUsername="alice"
        isOwnPost
      />,
    );
    openMenu();

    expect(
      screen.getByRole('menuitem', { name: 'feed_story_menu_edit' }),
    ).toHaveAttribute('href', '/editor?author=alice&permlink=p');
  });

  it('opens the inline editor for an own comment or thread', () => {
    const onEditInline = jest.fn();
    render(
      <StoryOverflowMenu
        authorName="alice"
        editHref={null}
        onEditInline={onEditInline}
        currentUsername="alice"
        isOwnPost
      />,
    );
    openMenu();

    expect(
      screen.queryByRole('menuitem', { name: 'feed_story_menu_edit' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'edit' }));
    expect(onEditInline).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it("has no edit entry on someone else's item", () => {
    render(
      <StoryOverflowMenu
        authorName="bob"
        editHref={null}
        onEditInline={jest.fn()}
        currentUsername="alice"
        isOwnPost={false}
      />,
    );
    openMenu();

    expect(screen.queryByRole('menuitem', { name: 'edit' })).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: 'feed_story_menu_edit' }),
    ).toBeNull();
  });
});

describe('StoryOverflowMenu object review entries', () => {
  function review(overrides: Partial<StoryObjectReviewMenu> = {}): StoryObjectReviewMenu {
    return {
      viewerPinned: false,
      pending: false,
      onPin: jest.fn(),
      onUnpin: jest.fn(),
      onRemove: jest.fn(),
      ...overrides,
    };
  }

  it('shows no Pin / Remove outside the object Posts feed', () => {
    render(
      <StoryOverflowMenu authorName="bob" editHref={null} currentUsername="alice" isOwnPost={false} />,
    );
    openMenu();

    expect(screen.queryByRole('menuitem', { name: 'object_post_menu_pin' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'object_post_menu_remove' })).toBeNull();
  });

  it('pins and removes on the object Posts feed', () => {
    const objectReview = review();
    render(
      <StoryOverflowMenu
        authorName="bob"
        editHref={null}
        currentUsername="alice"
        isOwnPost={false}
        objectReview={objectReview}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'object_post_menu_pin' }));
    expect(objectReview.onPin).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'object_post_menu_remove' }));
    expect(objectReview.onRemove).toHaveBeenCalledTimes(1);
  });

  it('offers Unpin for a post the viewer pinned', () => {
    const objectReview = review({ viewerPinned: true });
    render(
      <StoryOverflowMenu
        authorName="alice"
        editHref="/editor?author=alice&permlink=p"
        currentUsername="alice"
        isOwnPost
        objectReview={objectReview}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'object_post_menu_unpin' }));

    expect(objectReview.onUnpin).toHaveBeenCalledTimes(1);
    expect(objectReview.onPin).not.toHaveBeenCalled();
  });

  it('asks a logged-out viewer to log in instead of acting', () => {
    const objectReview = review();
    render(
      <StoryOverflowMenu
        authorName="bob"
        editHref={null}
        currentUsername={null}
        isOwnPost={false}
        objectReview={objectReview}
      />,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'object_post_menu_pin' }));

    expect(objectReview.onPin).not.toHaveBeenCalled();
  });
});
