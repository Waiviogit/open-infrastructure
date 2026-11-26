/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import type { UserProfileShellUser } from '../../domain/types/user-profile-shell-user';

const heroProps = jest.fn();
jest.mock('./user-profile-hero-client', () => ({
  UserProfileHeroClient: (props: { initialUser: UserProfileShellUser }) => {
    heroProps(props);
    const { useUserProfileSocialCounts } = jest.requireActual('./user-profile-social-counts-context');
    const counts = useUserProfileSocialCounts();
    return (
      <h1 data-counts={JSON.stringify(counts)}>{props.initialUser.displayName}</h1>
    );
  },
}));

jest.mock('./user-profile-pending-nav-root', () => ({
  UserProfilePendingNavRoot: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('./profile-content-skeletons', () => ({
  ProfilePageBodySkeleton: () => <div data-testid="body-skeleton" />,
}));

jest.mock('./profile-hero-skeleton', () => ({
  ProfileHeroSkeleton: () => <div data-testid="hero-skeleton" />,
}));

import { ProfileHeadShell } from './profile-head-shell';

const HEAD: UserProfileShellUser = {
  id: 'alice',
  name: 'alice',
  displayName: 'Alice',
  bio: '',
  followerCount: 7,
  followingCount: 2,
  postingCount: 9,
  wobjectsWeight: 1,
  coverImageUrl: null,
  avatarUrl: 'https://img/alice.png',
  isFollowing: false,
  viewerBell: false,
};

describe('ProfileHeadShell', () => {
  it('renders the hero from the head in pending mode, without a viewer or a sidebar', () => {
    render(<ProfileHeadShell accountName="alice" head={HEAD} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Alice' })).toBeTruthy();
    expect(heroProps).toHaveBeenCalledWith(
      expect.objectContaining({
        pending: true,
        accountName: 'alice',
        initialUser: HEAD,
        sidebar: null,
        viewerUsername: null,
      }),
    );
    expect(screen.getByLabelText('Loading profile posts')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('body-skeleton')).toBeTruthy();
  });

  it('gives the tabs the follower counts from the head', () => {
    render(<ProfileHeadShell accountName="alice" head={HEAD} />);

    expect(
      JSON.parse(screen.getByRole('heading', { level: 1 }).getAttribute('data-counts') ?? 'null'),
    ).toEqual({ followerCount: 7, followingCount: 2 });
  });
});
