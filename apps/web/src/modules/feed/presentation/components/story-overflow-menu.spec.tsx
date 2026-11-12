/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { StoryOverflowMenu } from './story-overflow-menu';

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
