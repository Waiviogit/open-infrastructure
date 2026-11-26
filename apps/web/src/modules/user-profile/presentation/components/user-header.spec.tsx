/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';

import type { UserAccountSidebarView } from '../../domain/types/user-account-sidebar-view';
import type { UserProfileShellUser } from './types';

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/icons', () => ({ BellIcon: () => null }));

jest.mock('@/shared/presentation', () => ({
  UserAvatar: ({ username }: { username: string }) => <span data-testid="avatar">{username}</span>,
  StatHoverTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  OptimisticNavLink: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('./user-profile-mobile-hero-meta', () => ({
  UserProfileMobileHeroMeta: ({ isLoading }: { isLoading?: boolean }) => (
    <div data-testid={isLoading ? 'meta-loading' : 'meta'} />
  ),
}));

jest.mock('./user-profile-mobile-hero-details', () => ({
  UserProfileMobileHeroDetails: ({ isLoading }: { isLoading?: boolean }) => (
    <div data-testid={isLoading ? 'details-loading' : 'details'} />
  ),
}));

import { UserHeader, type UserHeaderProps } from './user-header';

const USER: UserProfileShellUser = {
  id: 'alice',
  name: 'alice',
  displayName: 'Alice',
  bio: 'Coffee',
  followerCount: 3,
  followingCount: 4,
  postingCount: 5,
  wobjectsWeight: 1,
  coverImageUrl: null,
  avatarUrl: 'https://img/alice.png',
  isFollowing: false,
  viewerBell: false,
};

const SIDEBAR = { hive: { reputation: 61.25 } } as UserAccountSidebarView;

function props(overrides: Partial<UserHeaderProps>): UserHeaderProps {
  return {
    user: USER,
    username: 'alice',
    sidebar: null,
    isSameUser: false,
    isGuest: false,
    isFollowing: false,
    isBell: false,
    hasCover: false,
    coverImage: null,
    onFollowClick: jest.fn(),
    onBellToggle: jest.fn(),
    ...overrides,
  };
}

describe('UserHeader', () => {
  it('paints name, avatar and counts on the first render', () => {
    render(<UserHeader {...props({})} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Alice' })).toBeTruthy();
    expect(screen.getByTestId('avatar')).toHaveTextContent('alice');
    expect(screen.getByText(/3 followers/)).toBeTruthy();
  });

  it('shows sidebar placeholders until the sidebar resolves, then the reputation', async () => {
    let resolve: (value: UserAccountSidebarView | null) => void = () => undefined;
    const sidebar = new Promise<UserAccountSidebarView | null>((r) => {
      resolve = r;
    });
    await act(async () => {
      render(<UserHeader {...props({ sidebar })} />);
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Alice' })).toBeTruthy();
    expect(screen.getByTestId('meta-loading')).toBeTruthy();
    expect(screen.queryByText('61.25')).toBeNull();

    await act(async () => {
      resolve(SIDEBAR);
      await sidebar;
    });

    expect(await screen.findByText('61.25')).toBeTruthy();
    expect(screen.getByTestId('meta')).toBeTruthy();
    expect(screen.getByTestId('details')).toBeTruthy();
  });

  it('hides viewer controls and the guest badge while pending', () => {
    render(<UserHeader {...props({ pending: true, isGuest: true })} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Alice' })).toBeTruthy();
    expect(screen.queryByText('guest')).toBeNull();
    expect(screen.queryByText('follow')).toBeNull();
    expect(screen.queryByText('edit_profile')).toBeNull();
    expect(screen.getByTestId('meta-loading')).toBeTruthy();
  });

  it('shows the follow button for a signed-in visitor once loaded', () => {
    render(<UserHeader {...props({})} />);
    expect(screen.getByText('follow')).toBeTruthy();
  });
});
