/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { Messages } from '@/i18n/types';

import type { ActivityRowView } from '../../domain/types/activity-row-view';
import { ActivityRowContent } from './activity-row-content';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const followRow: ActivityRowView = {
  kind: 'custom_follow',
  id: 'f1',
  timestamp: '2026-05-19T10:00:00.000Z',
  follower: 'alice',
  following: 'bob',
  what: 'blog',
};

function renderRow(row: ActivityRowView, messages: Messages) {
  return render(
    <I18nProvider locale="en-US" messages={messages}>
      <ActivityRowContent row={row} />
    </I18nProvider>,
  );
}

function rowText(container: HTMLElement): string {
  return container.querySelector('.break-words')?.textContent ?? '';
}

describe('ActivityRowContent', () => {
  it('places the followed account link where the sentence puts it', () => {
    const { container } = renderRow(followRow, { followed_user: '{following} hat gefolgt' });

    expect(screen.getByRole('link', { name: '@bob' })).toHaveAttribute('href', '/@bob');
    expect(rowText(container)).toBe('@bob hat gefolgt');
  });

  it('keeps the English order with the link after the label', () => {
    const { container } = renderRow(followRow, { followed_user: 'Followed {following}' });

    expect(rowText(container)).toBe('Followed @bob');
  });

  it('appends the link when the label has no placeholder', () => {
    const { container } = renderRow(followRow, { followed_user: 'Followed' });

    expect(rowText(container)).toBe('Followed @bob');
  });

  it('fills the voter into the vote sentence', () => {
    const { container } = renderRow(
      {
        kind: 'vote',
        id: 'v1',
        timestamp: '2026-05-19T10:00:00.000Z',
        voter: 'carol',
        author: 'bob',
        permlink: 'post-1',
        weight: 5000,
        isProfileActor: false,
      },
      { user_upvoted: '{username} upvoted' },
    );

    expect(rowText(container)).toBe('@carol upvoted (50.00%) @bob/post-1');
  });
});
